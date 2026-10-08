package com.algoarena.competition.service;

import com.algoarena.competition.config.CompetitionProperties;
import com.algoarena.competition.domain.Competition;
import com.algoarena.competition.domain.CompetitionParticipant;
import com.algoarena.competition.domain.CompetitionQuestion;
import com.algoarena.competition.domain.CompetitionStateMachine;
import com.algoarena.competition.domain.CompetitionStatus;
import com.algoarena.competition.domain.ParticipantStatus;
import com.algoarena.competition.domain.RankingCalculator;
import com.algoarena.competition.question.CompetitionQuestionSource;
import com.algoarena.competition.question.QuestionSelector;
import com.algoarena.competition.question.SnapshotQuestion;
import com.algoarena.competition.repository.CompetitionParticipantRepository;
import com.algoarena.competition.repository.CompetitionQuestionRepository;
import com.algoarena.competition.repository.CompetitionRepository;
import com.algoarena.competition.ws.CompetitionEventPublisher;
import com.algoarena.exception.ConflictException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.time.Clock;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

/**
 * Every lifecycle transition of a competition. All mutating methods run while holding the competition row
 * lock (taken by the caller or by {@link #advance(Long)}), are idempotent, and go through
 * {@link CompetitionStateMachine}.
 */
@Slf4j
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(prefix = "competition", name = "enabled", havingValue = "true")
public class CompetitionLifecycleService {

    private final CompetitionRepository competitions;
    private final CompetitionParticipantRepository participants;
    private final CompetitionQuestionRepository questions;
    private final CompetitionQuestionSource questionSource;
    private final CompetitionProperties props;
    private final CompetitionEventPublisher events;
    private final CompetitionActivity activity;
    private final Clock clock;

    private final SecureRandom seedGenerator = new SecureRandom();

    // ------------------------------------------------------------------ transitions (caller holds the lock)

    /**
     * LOBBY -> STARTING: freezes the roster, SELECTS AND SNAPSHOTS the questions on the server, and fixes the
     * server-authoritative start and end times.
     */
    public void beginCountdown(Competition c, Instant now) {
        CompetitionStateMachine.requireTransition(c.getStatus(), CompetitionStatus.STARTING);
        if (c.getPlayerCount() < c.getMinPlayers()) {
            throw new ConflictException("At least " + c.getMinPlayers() + " players are needed to start");
        }
        long seed = seedGenerator.nextLong();
        List<SnapshotQuestion> selected = QuestionSelector.select(questionSource.all(),
                QuestionSelector.parseMix(props.getDifficultyMix()), c.getQuestionCount(), props.getMaxPerCategory(), seed);

        List<CompetitionQuestion> rows = new ArrayList<>();
        for (SnapshotQuestion q : selected) {
            CompetitionQuestion row = new CompetitionQuestion();
            row.setCompetitionId(c.getId());
            row.setQuestionNumber(q.number());
            row.setSourceId(q.sourceId());
            row.setCategory(q.category());
            row.setDifficulty(q.difficulty());
            row.setQuestionText(q.text());
            row.setOptions(q.options());
            row.setCorrectIndex(q.correctIndex());
            row.setExplanation(q.explanation());
            rows.add(row);
        }
        questions.saveAll(rows);

        c.setQuestionSeed(seed);
        c.setStartTime(now.plusSeconds(c.getCountdownSeconds()));
        c.setEndTime(c.getStartTime().plusSeconds(c.getDurationSeconds()));
        c.setParticipantCountAtStart(c.getPlayerCount());
        c.setStatus(CompetitionStatus.STARTING);
        c.bumpVersion();
        competitions.save(c);
        activity.markActive();
        events.starting(c);
    }

    /** STARTING -> RUNNING at the start time. */
    public void startRunning(Competition c) {
        CompetitionStateMachine.requireTransition(c.getStatus(), CompetitionStatus.RUNNING);
        c.setStatus(CompetitionStatus.RUNNING);
        c.bumpVersion();
        competitions.save(c);
        events.started(c);
    }

    /** LOBBY/STARTING -> CANCELLED (never started). Releases every participant's single-competition slot. */
    public void cancel(Competition c, String reason, Instant now) {
        CompetitionStateMachine.requireTransition(c.getStatus(), CompetitionStatus.CANCELLED);
        for (CompetitionParticipant p : participants.roster(c.getId())) {
            p.setActive(false);
            participants.save(p);
        }
        c.setStatus(CompetitionStatus.CANCELLED);
        c.setCancelledReason(reason);
        c.setFinishedAt(now);
        c.bumpVersion();
        competitions.save(c);
        events.cancelled(c);
    }

    /**
     * RUNNING -> FINISHED: ranks everyone with the deterministic comparator and stores the immutable result on the
     * participant rows. Locks every participant first, which waits for any in-flight submission to commit, so no
     * answer can slip in after the ranking is computed.
     */
    public void finalizeCompetition(Competition c, Instant now) {
        CompetitionStateMachine.requireTransition(c.getStatus(), CompetitionStatus.FINISHED);
        List<CompetitionParticipant> members = participants.findAllMembersForUpdate(c.getId(), ParticipantStatus.LEFT);
        long durationMs = c.getDurationSeconds() * 1000L;

        List<RankingCalculator.Entry> entries = new ArrayList<>();
        for (CompetitionParticipant p : members) {
            long completion = RankingCalculator.completionMs(c.getStartTime(), p.getFinishedAt(), durationMs);
            p.setFinalCompletionMs(completion);
            entries.add(new RankingCalculator.Entry(p.getId(), p.getScore(), p.getCorrectCount(), completion, p.getLastSubmissionAt()));
        }
        List<RankingCalculator.Entry> ranked = RankingCalculator.rank(entries);
        for (CompetitionParticipant p : members) {
            for (int i = 0; i < ranked.size(); i++) {
                if (ranked.get(i).participantId() == p.getId()) {
                    p.setFinalRank(i + 1);
                    break;
                }
            }
            p.setActive(false);
            participants.save(p);
        }

        c.setStatus(CompetitionStatus.FINISHED);
        c.setFinishedAt(now);
        c.bumpVersion();
        competitions.save(c);
        events.ended(c);
        log.info("[Competition] {} finished with {} participants", c.getId(), members.size());
    }

    // ------------------------------------------------------------------ driven by the ticker / lazily by requests

    /** Ids of competitions whose next step is due now. */
    @Transactional(readOnly = true)
    public List<Long> findDue() {
        Instant now = clock.instant();
        return competitions.findDue(now, now.minusMillis(props.getFinalizeDelayMs()));
    }

    /** True if a quick unlocked look says this competition has a step due (used to avoid taking locks needlessly). */
    public static boolean isDue(CompetitionRepository.StatusView v, Instant now, long finalizeDelayMs) {
        return switch (v.getStatus()) {
            case LOBBY -> !now.isBefore(v.getLobbyDeadlineAt());
            case STARTING -> v.getStartTime() != null && !now.isBefore(v.getStartTime());
            case RUNNING -> v.getEndTime() != null && !now.isBefore(v.getEndTime().plusMillis(finalizeDelayMs));
            default -> false;
        };
    }

    /** Performs whatever step is due, if any. Safe to call repeatedly and from several threads. */
    @Transactional
    public void advance(Long competitionId) {
        Competition c = competitions.findByIdForUpdate(competitionId).orElse(null);
        if (c == null) {
            return;
        }
        Instant now = clock.instant();
        switch (c.getStatus()) {
            case LOBBY -> {
                if (!now.isBefore(c.getLobbyDeadlineAt())) {
                    if (c.getPlayerCount() >= c.getMinPlayers()) {
                        beginCountdown(c, now);
                    } else {
                        cancel(c, "NOT_ENOUGH_PLAYERS", now);
                    }
                }
            }
            case STARTING -> {
                if (!now.isBefore(c.getStartTime())) {
                    if (c.getPlayerCount() >= c.getMinPlayers()) {
                        startRunning(c);
                    } else {
                        cancel(c, "NOT_ENOUGH_PLAYERS", now);
                    }
                }
            }
            case RUNNING -> {
                boolean timeUp = !now.isBefore(c.getEndTime().plusMillis(props.getFinalizeDelayMs()));
                if (timeUp || everyoneFinished(c)) {
                    finalizeCompetition(c, now);
                }
            }
            default -> { /* terminal: nothing to do */ }
        }
    }

    /**
     * Early close: once EVERY participant has finished there is nobody left to wait for, so the competition
     * ends immediately. Called after a participant finishes; a cheap unlocked count avoids needless locking.
     */
    @Transactional
    public void closeIfAllFinished(Long competitionId) {
        if (participants.countUnfinished(competitionId) > 0) {
            return;
        }
        Competition c = competitions.findByIdForUpdate(competitionId).orElse(null);
        if (c != null && c.getStatus() == CompetitionStatus.RUNNING && everyoneFinished(c)) {
            finalizeCompetition(c, clock.instant());
        }
    }

    private boolean everyoneFinished(Competition c) {
        return participants.countUnfinished(c.getId()) == 0 && participants.countFinished(c.getId()) > 0;
    }
}
