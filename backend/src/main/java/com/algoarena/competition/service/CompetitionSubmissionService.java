package com.algoarena.competition.service;

import com.algoarena.competition.config.CompetitionProperties;
import com.algoarena.competition.domain.Competition;
import com.algoarena.competition.domain.CompetitionParticipant;
import com.algoarena.competition.domain.CompetitionQuestion;
import com.algoarena.competition.domain.CompetitionStateMachine;
import com.algoarena.competition.domain.CompetitionStatus;
import com.algoarena.competition.domain.CompetitionSubmission;
import com.algoarena.competition.domain.ParticipantStatus;
import com.algoarena.competition.repository.CompetitionParticipantRepository;
import com.algoarena.competition.repository.CompetitionQuestionRepository;
import com.algoarena.competition.repository.CompetitionRepository;
import com.algoarena.competition.repository.CompetitionSubmissionRepository;
import com.algoarena.competition.web.CompetitionDtos.ParticipantResultDto;
import com.algoarena.competition.web.CompetitionDtos.SubmissionResultDto;
import com.algoarena.competition.ws.CompetitionEventPublisher;
import com.algoarena.exception.BadRequestException;
import com.algoarena.exception.ConflictException;
import com.algoarena.exception.ForbiddenException;
import com.algoarena.exception.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.Instant;

/**
 * Grades answers. Server-authoritative end to end:
 * <ul>
 *   <li>the participant is derived from the authenticated user - there is no user id in the request;</li>
 *   <li>correctness is decided against the competition's own snapshot ({@code correct_index});</li>
 *   <li>the timestamp is the server receive time ({@code receivedAt}, captured at the edge of the API);</li>
 *   <li>score is 100 per correct answer, 0 for a wrong one, never negative;</li>
 *   <li>each question can be answered once: a replay returns the original verdict and changes nothing.</li>
 * </ul>
 *
 * <p><b>Ordering / races:</b> the participant row is locked FIRST, and only then is the competition status read
 * fresh from the database. Finalisation also locks every participant row, so a submission that was waiting on
 * that lock re-checks the status after it wakes up and is rejected instead of landing after the ranking.
 */
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(prefix = "competition", name = "enabled", havingValue = "true")
public class CompetitionSubmissionService {

    /** Flat scoring for version 1. Isolated here so a different policy can replace it later. */
    static final int POINTS_PER_CORRECT_ANSWER = 100;

    private final CompetitionRepository competitions;
    private final CompetitionParticipantRepository participants;
    private final CompetitionQuestionRepository questions;
    private final CompetitionSubmissionRepository submissions;
    private final CompetitionEventPublisher events;
    private final CompetitionProperties props;
    private final Clock clock;

    @Transactional
    public SubmissionResultDto submit(Long competitionId, Long userId, int questionNumber, int selectedOption, Instant receivedAt) {
        CompetitionParticipant p = lockParticipant(competitionId, userId);
        CompetitionRepository.StatusView view = requireRunning(competitionId, receivedAt, p, questionNumber);

        // A replay (also after the participant finished) returns the original verdict and changes nothing.
        CompetitionSubmission existing = submissions.findByParticipantIdAndQuestionNumber(p.getId(), questionNumber).orElse(null);
        if (existing != null) {
            return result(existing, p, true, view.getQuestionCount());
        }
        if (p.getStatus() == ParticipantStatus.FINISHED) {
            throw new ConflictException("You have already finished this competition");
        }
        if (questionNumber < 1 || questionNumber > view.getQuestionCount()) {
            throw new BadRequestException("Unknown question");
        }
        CompetitionQuestion question = questions.findByCompetitionIdAndQuestionNumber(competitionId, questionNumber)
                .orElseThrow(() -> new BadRequestException("Unknown question"));
        if (selectedOption < 0 || selectedOption >= question.getOptions().size()) {
            throw new BadRequestException("Unknown option");
        }

        boolean correct = selectedOption == question.getCorrectIndex();
        int points = correct ? POINTS_PER_CORRECT_ANSWER : 0;

        CompetitionSubmission s = new CompetitionSubmission();
        s.setCompetitionId(competitionId);
        s.setParticipantId(p.getId());
        s.setQuestionNumber(questionNumber);
        s.setSelectedIndex(selectedOption);
        s.setCorrect(correct);
        s.setScoreAwarded(points);
        s.setSubmittedAt(receivedAt);
        submissions.saveAndFlush(s);   // UNIQUE (participant_id, question_number) is the backstop

        p.setAnsweredCount(p.getAnsweredCount() + 1);
        p.setCorrectCount(p.getCorrectCount() + (correct ? 1 : 0));
        p.setScore(p.getScore() + points);
        p.setLastSubmissionAt(receivedAt);
        boolean finishedNow = p.getAnsweredCount() >= view.getQuestionCount();
        if (finishedNow) {
            p.setStatus(ParticipantStatus.FINISHED);
            p.setFinishedAt(receivedAt);
        }
        participants.saveAndFlush(p);
        if (finishedNow) {
            announceFinished(competitionId, p);
        }
        return result(s, p, false, view.getQuestionCount());
    }

    /** The player declares they are done (remaining questions count as unanswered). Idempotent. */
    @Transactional
    public ParticipantResultDto finish(Long competitionId, Long userId, Instant receivedAt) {
        CompetitionParticipant p = lockParticipant(competitionId, userId);
        if (p.getStatus() == ParticipantStatus.FINISHED) {
            return participantResult(p);
        }
        requireRunning(competitionId, receivedAt, p, 0);

        p.setStatus(ParticipantStatus.FINISHED);
        p.setFinishedAt(receivedAt);
        participants.saveAndFlush(p);
        announceFinished(competitionId, p);
        return participantResult(p);
    }

    // ------------------------------------------------------------------ guards

    private CompetitionParticipant lockParticipant(Long competitionId, Long userId) {
        CompetitionParticipant p = participants.findForUpdate(competitionId, userId)
                .orElseThrow(() -> new ForbiddenException("You are not a participant in this competition"));
        if (p.getStatus() == ParticipantStatus.LEFT) {
            throw new ForbiddenException("You are not a participant in this competition");
        }
        return p;
    }

    /**
     * Reads the competition status FRESH (after the participant lock is held) and rejects anything that is not an
     * in-time submission to a RUNNING competition.
     */
    private CompetitionRepository.StatusView requireRunning(Long competitionId, Instant receivedAt,
                                                             CompetitionParticipant p, int questionNumber) {
        CompetitionRepository.StatusView view = competitions.findStatusView(competitionId)
                .orElseThrow(() -> new ResourceNotFoundException("Competition not found"));
        if (view.getStatus() == CompetitionStatus.FINISHED || view.getStatus() == CompetitionStatus.CANCELLED) {
            throw new ConflictException("The competition has ended");
        }
        if (!CompetitionStateMachine.canSubmit(view.getStatus())) {
            throw new ConflictException("The competition has not started yet");
        }
        if (receivedAt.isAfter(view.getEndTime().plusMillis(props.getSubmissionGraceMs()))) {
            throw new ConflictException("The competition has ended");
        }
        return view;
    }

    // ------------------------------------------------------------------ mapping / events

    private SubmissionResultDto result(CompetitionSubmission s, CompetitionParticipant p, boolean alreadySubmitted, int questionCount) {
        return new SubmissionResultDto(s.getQuestionNumber(), s.isCorrect(), s.getScoreAwarded(), p.getScore(),
                p.getAnsweredCount(), alreadySubmitted, p.getStatus() == ParticipantStatus.FINISHED, clock.instant());
    }

    private ParticipantResultDto participantResult(CompetitionParticipant p) {
        return new ParticipantResultDto(p.getStatus() == ParticipantStatus.FINISHED, p.getFinishedAt(), p.getScore(),
                p.getCorrectCount(), p.getAnsweredCount(), clock.instant());
    }

    private void announceFinished(Long competitionId, CompetitionParticipant p) {
        Competition c = competitions.findById(competitionId).orElse(null);
        if (c != null) {
            events.playerFinished(c, p.getUser().getUsername(), participants.countFinished(competitionId),
                    c.getParticipantCountAtStart() != null ? c.getParticipantCountAtStart() : c.getPlayerCount());
        }
    }
}
