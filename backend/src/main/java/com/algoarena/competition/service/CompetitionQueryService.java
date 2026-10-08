package com.algoarena.competition.service;

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
import com.algoarena.competition.web.CompetitionDtos.AnswerDto;
import com.algoarena.competition.web.CompetitionDtos.CompetitionPageDto;
import com.algoarena.competition.web.CompetitionDtos.CompetitionQuestionsDto;
import com.algoarena.competition.web.CompetitionDtos.CompetitionStateDto;
import com.algoarena.competition.web.CompetitionDtos.CompetitionSummaryDto;
import com.algoarena.competition.web.CompetitionDtos.LeaderboardDto;
import com.algoarena.competition.web.CompetitionDtos.LeaderboardEntryDto;
import com.algoarena.competition.web.CompetitionDtos.MyProgressDto;
import com.algoarena.competition.web.CompetitionDtos.PlayerDto;
import com.algoarena.competition.web.CompetitionDtos.QuestionDto;
import com.algoarena.competition.web.CompetitionDtos.ResultReviewDto;
import com.algoarena.competition.web.CompetitionDtos.ReviewItemDto;
import com.algoarena.entity.User;
import com.algoarena.exception.ConflictException;
import com.algoarena.exception.ForbiddenException;
import com.algoarena.exception.ResourceNotFoundException;
import com.algoarena.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Read side. Everything is derived from the database for the requesting user, so a refreshed or reconnecting
 * client can always rebuild the whole picture from REST. Correct options and explanations are produced ONLY by
 * {@link #review}, only for a FINISHED competition, and only for the caller's own answers.
 */
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(prefix = "competition", name = "enabled", havingValue = "true")
@Transactional(readOnly = true)
public class CompetitionQueryService {

    private final CompetitionRepository competitions;
    private final CompetitionParticipantRepository participants;
    private final CompetitionQuestionRepository questions;
    private final CompetitionSubmissionRepository submissions;
    private final UserRepository users;
    private final Clock clock;

    public CompetitionPageDto openLobbies(int page, int size) {
        int safePage = Math.max(0, page);
        int safeSize = Math.min(Math.max(1, size), 50);
        Page<Competition> result = competitions.findByStatusOrderByCreatedAtDesc(CompetitionStatus.LOBBY, PageRequest.of(safePage, safeSize));
        List<CompetitionSummaryDto> items = result.getContent().stream().map(this::summary).toList();
        return new CompetitionPageDto(items, safePage, safeSize, result.getTotalElements());
    }

    public CompetitionStateDto state(Long competitionId, Long userId) {
        Competition c = competitions.findById(competitionId).orElseThrow(() -> new ResourceNotFoundException("Competition not found"));
        CompetitionParticipant me = member(competitionId, userId);

        if (me == null) {
            // Non-participants may only look at an open lobby, and see a summary of it.
            if (c.getStatus() != CompetitionStatus.LOBBY) {
                throw new ForbiddenException("You are not a participant in this competition");
            }
            return stateDto(c, null, null, userId, hostUsername(c, null));
        }
        List<CompetitionParticipant> roster = participants.roster(competitionId);
        return stateDto(c, me, roster, userId, hostUsername(c, roster));
    }

    public CompetitionQuestionsDto questions(Long competitionId, Long userId) {
        Competition c = competitions.findById(competitionId).orElseThrow(() -> new ResourceNotFoundException("Competition not found"));
        requireMember(competitionId, userId);
        if (!CompetitionStateMachine.canViewQuestions(c.getStatus())) {
            throw new ConflictException(c.getStatus() == CompetitionStatus.FINISHED || c.getStatus() == CompetitionStatus.CANCELLED
                    ? "The competition has ended" : "The competition has not started yet");
        }
        // number, text and options ONLY - the snapshot's correct index / explanation are never read into a DTO here
        List<QuestionDto> list = questions.findByCompetitionIdOrderByQuestionNumberAsc(competitionId).stream()
                .map(q -> new QuestionDto(q.getQuestionNumber(), q.getQuestionText(), List.copyOf(q.getOptions())))
                .toList();
        return new CompetitionQuestionsDto(c.getId(), clock.instant(), c.getStartTime(), c.getEndTime(), list);
    }

    public LeaderboardDto leaderboard(Long competitionId, Long userId) {
        Competition c = finished(competitionId);
        requireMember(competitionId, userId);

        List<CompetitionParticipant> ranked = participants.ranked(competitionId);
        List<LeaderboardEntryDto> entries = ranked.stream().map(p -> entry(c, p, userId)).toList();
        LeaderboardEntryDto you = entries.stream().filter(LeaderboardEntryDto::you).findFirst().orElse(null);
        return new LeaderboardDto(c.getId(), c.getFinishedAt(), entries.size(), entries, you);
    }

    public ResultReviewDto review(Long competitionId, Long userId) {
        Competition c = finished(competitionId);
        CompetitionParticipant me = requireMember(competitionId, userId);

        Map<Integer, CompetitionSubmission> mine = submissions.findByParticipantIdOrderByQuestionNumberAsc(me.getId()).stream()
                .collect(Collectors.toMap(CompetitionSubmission::getQuestionNumber, Function.identity()));
        List<ReviewItemDto> items = questions.findByCompetitionIdOrderByQuestionNumberAsc(competitionId).stream().map(q -> {
            CompetitionSubmission s = mine.get(q.getQuestionNumber());
            return new ReviewItemDto(q.getQuestionNumber(), q.getQuestionText(), List.copyOf(q.getOptions()),
                    s == null ? null : s.getSelectedIndex(), q.getCorrectIndex(), s != null && s.isCorrect(), q.getExplanation());
        }).toList();
        return new ResultReviewDto(c.getId(), me.getFinalRank() == null ? 0 : me.getFinalRank(), me.getScore(), me.getCorrectCount(), items);
    }

    // ------------------------------------------------------------------ helpers

    private Competition finished(Long competitionId) {
        Competition c = competitions.findById(competitionId).orElseThrow(() -> new ResourceNotFoundException("Competition not found"));
        if (!CompetitionStateMachine.canViewResults(c.getStatus())) {
            throw new ConflictException("Results are available once the competition has finished");
        }
        return c;
    }

    private CompetitionParticipant member(Long competitionId, Long userId) {
        return participants.findByCompetitionIdAndUserId(competitionId, userId)
                .filter(p -> p.getStatus() != ParticipantStatus.LEFT).orElse(null);
    }

    private CompetitionParticipant requireMember(Long competitionId, Long userId) {
        CompetitionParticipant p = member(competitionId, userId);
        if (p == null) {
            throw new ForbiddenException("You are not a participant in this competition");
        }
        return p;
    }

    private CompetitionSummaryDto summary(Competition c) {
        return new CompetitionSummaryDto(c.getId(), c.getStatus().name(), c.getPlayerCount(), c.getMinPlayers(), c.getMaxPlayers(),
                hostUsername(c, null), c.getLobbyDeadlineAt(), c.getCreatedAt());
    }

    private LeaderboardEntryDto entry(Competition c, CompetitionParticipant p, Long viewerId) {
        return new LeaderboardEntryDto(p.getFinalRank() == null ? 0 : p.getFinalRank(), p.getUser().getUsername(), p.getScore(),
                p.getCorrectCount(), p.getFinalCompletionMs() == null ? 0 : p.getFinalCompletionMs(),
                p.getAnsweredCount() >= c.getQuestionCount(), p.getUser().getId().equals(viewerId));
    }

    private CompetitionStateDto stateDto(Competition c, CompetitionParticipant me, List<CompetitionParticipant> roster,
                                         Long viewerId, String hostUsername) {
        boolean member = me != null;
        List<PlayerDto> players = null;
        MyProgressDto progress = null;
        int finishedCount = 0;
        if (member) {
            players = roster.stream().map(p -> new PlayerDto(p.getUser().getUsername(), p.getUser().getLevel(),
                    p.getUser().getId().equals(c.getHostId()), p.getUser().getId().equals(viewerId), p.getStatus().name())).toList();
            finishedCount = (int) roster.stream().filter(p -> p.getStatus() == ParticipantStatus.FINISHED).count();
            List<AnswerDto> answers = submissions.findByParticipantIdOrderByQuestionNumberAsc(me.getId()).stream()
                    .map(s -> new AnswerDto(s.getQuestionNumber(), s.getSelectedIndex(), s.isCorrect())).toList();
            progress = new MyProgressDto(me.getStatus().name(), me.getAnsweredCount(), me.getCorrectCount(), me.getScore(),
                    me.getStatus() == ParticipantStatus.FINISHED, me.getFinishedAt(), answers);
        }
        boolean canStart = member && c.getStatus() == CompetitionStatus.LOBBY && viewerId.equals(c.getHostId())
                && c.getPlayerCount() >= c.getMinPlayers();
        return new CompetitionStateDto(c.getId(), c.getStatus().name(), c.getVersion(), clock.instant(), c.getMinPlayers(),
                c.getMaxPlayers(), c.getPlayerCount(), c.getQuestionCount(), c.getDurationSeconds(), c.getCountdownSeconds(),
                c.getLobbyDeadlineAt(), c.getStartTime(), c.getEndTime(), c.getFinishedAt(), c.getCancelledReason(), hostUsername,
                member, canStart, finishedCount, players, progress);
    }

    private String hostUsername(Competition c, List<CompetitionParticipant> roster) {
        if (roster != null) {
            for (CompetitionParticipant p : roster) {
                if (p.getUser().getId().equals(c.getHostId())) {
                    return p.getUser().getUsername();
                }
            }
        }
        return users.findById(c.getHostId()).map(User::getUsername).orElse("");
    }
}
