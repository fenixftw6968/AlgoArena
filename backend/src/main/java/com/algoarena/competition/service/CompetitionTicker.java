package com.algoarena.competition.service;

import com.algoarena.competition.config.CompetitionProperties;
import com.algoarena.competition.domain.CompetitionParticipant;
import com.algoarena.competition.domain.CompetitionStatus;
import com.algoarena.competition.domain.ParticipantStatus;
import com.algoarena.competition.repository.CompetitionParticipantRepository;
import com.algoarena.competition.repository.CompetitionRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Clock;
import java.time.Instant;
import java.util.EnumSet;
import java.util.List;

/**
 * Drives time-based transitions (lobby deadline, countdown end, competition end) from the database - never from
 * in-memory timers - so a restart or a missed tick cannot lose a competition: whatever is overdue is processed on
 * the next run. Requests also advance an overdue competition lazily, so users never wait for this thread.
 *
 * <p>While no competition is live the ticker does not touch the database at all (see {@link CompetitionActivity}).
 */
@Slf4j
@Component
@ConditionalOnProperty(prefix = "competition", name = "enabled", havingValue = "true")
public class CompetitionTicker {

    private final CompetitionLifecycleService lifecycle;
    private final CompetitionLobbyService lobby;
    private final CompetitionRepository competitions;
    private final CompetitionParticipantRepository participants;
    private final CompetitionActivity activity;
    private final CompetitionProperties props;
    private final Clock clock;

    private volatile long lastErrorLogMillis = 0;

    public CompetitionTicker(CompetitionLifecycleService lifecycle, CompetitionLobbyService lobby, CompetitionRepository competitions,
                             CompetitionParticipantRepository participants, CompetitionActivity activity,
                             CompetitionProperties props, Clock clock) {
        this.lifecycle = lifecycle;
        this.lobby = lobby;
        this.competitions = competitions;
        this.participants = participants;
        this.activity = activity;
        this.props = props;
        this.clock = clock;
    }

    @Scheduled(fixedDelay = 1000)
    public void tick() {
        if (!activity.shouldPoll()) {
            return;
        }
        try {
            for (Long id : lifecycle.findDue()) {
                try {
                    lifecycle.advance(id);
                } catch (Exception e) {
                    log.error("[Competition] could not advance competition {}: {}", id, e.toString());
                }
            }
            removeGhostsFromLobbies();
            boolean anyLive = competitions.countByStatusIn(EnumSet.of(CompetitionStatus.LOBBY, CompetitionStatus.STARTING, CompetitionStatus.RUNNING)) > 0;
            activity.recordCheck(anyLive);
        } catch (Exception e) {
            // e.g. the competition tables have not been created yet: log at most once a minute, never crash the scheduler
            long now = System.currentTimeMillis();
            if (now - lastErrorLogMillis > 60_000) {
                lastErrorLogMillis = now;
                log.error("[Competition] ticker failed: {}", e.toString());
            }
        }
    }

    private void removeGhostsFromLobbies() {
        Instant cutoff = clock.instant().minusSeconds(props.getDisconnectGraceSeconds());
        List<CompetitionParticipant> stale = participants.findStaleDisconnected(cutoff, ParticipantStatus.JOINED,
                EnumSet.of(CompetitionStatus.LOBBY, CompetitionStatus.STARTING));
        for (CompetitionParticipant p : stale) {
            try {
                lobby.autoLeave(p.getCompetitionId(), p.getUser().getId());
            } catch (Exception e) {
                log.warn("[Competition] could not remove a disconnected member: {}", e.getClass().getSimpleName());
            }
        }
    }
}
