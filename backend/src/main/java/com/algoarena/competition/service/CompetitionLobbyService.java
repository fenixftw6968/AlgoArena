package com.algoarena.competition.service;

import com.algoarena.competition.config.CompetitionProperties;
import com.algoarena.competition.domain.Competition;
import com.algoarena.competition.domain.CompetitionParticipant;
import com.algoarena.competition.domain.CompetitionStateMachine;
import com.algoarena.competition.domain.CompetitionStatus;
import com.algoarena.competition.domain.ParticipantStatus;
import com.algoarena.competition.repository.CompetitionParticipantRepository;
import com.algoarena.competition.repository.CompetitionRepository;
import com.algoarena.competition.ws.CompetitionEventPublisher;
import com.algoarena.entity.User;
import com.algoarena.exception.ConflictException;
import com.algoarena.exception.ForbiddenException;
import com.algoarena.exception.ResourceNotFoundException;
import com.algoarena.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.Instant;
import java.util.List;

/**
 * Lobby operations: create, join, leave, start.
 *
 * <p><b>Concurrency:</b> every method first takes {@code SELECT ... FOR UPDATE} on the competition row, so joins,
 * leaves, the start and the lifecycle ticker are serialised per competition. Capacity is then checked against
 * {@code player_count} <i>inside</i> that lock, and the database independently enforces
 * {@code CHECK (player_count <= max_players <= 25)}, {@code UNIQUE (competition_id, user_id)} and a partial unique
 * index allowing a user a single live competition. There is no check-then-act window.
 */
@Slf4j
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(prefix = "competition", name = "enabled", havingValue = "true")
public class CompetitionLobbyService {

    private final CompetitionRepository competitions;
    private final CompetitionParticipantRepository participants;
    private final UserRepository users;
    private final CompetitionLifecycleService lifecycle;
    private final CompetitionEventPublisher events;
    private final CompetitionActivity activity;
    private final CompetitionProperties props;
    private final Clock clock;

    /** Creates a lobby; the creator is its first participant and its host. */
    @Transactional
    public Competition create(User user) {
        if (!participants.findActiveByUserId(user.getId()).isEmpty()) {
            throw new ConflictException("You are already in a competition");
        }
        Instant now = clock.instant();

        Competition c = new Competition();
        c.setStatus(CompetitionStatus.LOBBY);
        c.setCreatedBy(user.getId());
        c.setHostId(user.getId());
        c.setMinPlayers(props.getMinPlayers());
        c.setMaxPlayers(props.getMaxPlayers());
        c.setQuestionCount(props.getQuestionCount());
        c.setDurationSeconds(props.getDurationSeconds());
        c.setCountdownSeconds(props.getCountdownSeconds());
        c.setPlayerCount(1);
        c.setCreatedAt(now);
        c.setLobbyDeadlineAt(now.plusSeconds(props.getLobbyTtlSeconds()));
        c.setVersion(1);
        c = competitions.saveAndFlush(c);

        CompetitionParticipant p = new CompetitionParticipant();
        p.setCompetitionId(c.getId());
        p.setUser(user);
        p.setJoinedAt(now);
        participants.saveAndFlush(p);   // surfaces the "one live competition per user" index immediately

        activity.markActive();
        events.lobbyUpdated(c, participants.roster(c.getId()), user.getUsername());
        return c;
    }

    /**
     * Joins an open lobby. Idempotent for an existing member. Rejects (409) a full lobby, a started/finished
     * competition and a user who is in another live competition.
     */
    @Transactional
    public Competition join(Long competitionId, User user) {
        Competition c = competitions.findByIdForUpdate(competitionId)
                .orElseThrow(() -> new ResourceNotFoundException("Competition not found"));

        CompetitionParticipant existing = participants.findByCompetitionIdAndUserId(competitionId, user.getId()).orElse(null);
        if (existing != null && existing.getStatus() != ParticipantStatus.LEFT) {
            return c; // already a member: safe retry
        }
        if (!CompetitionStateMachine.canJoin(c.getStatus())) {
            throw new ConflictException(c.getStatus() == CompetitionStatus.CANCELLED || c.getStatus() == CompetitionStatus.FINISHED
                    ? "This competition has ended" : "This competition has already started");
        }
        if (c.isFull()) {
            throw new ConflictException("This competition is full");
        }
        for (CompetitionParticipant other : participants.findActiveByUserId(user.getId())) {
            if (!other.getCompetitionId().equals(competitionId)) {
                throw new ConflictException("You are already in another competition");
            }
        }

        Instant now = clock.instant();
        CompetitionParticipant p = existing != null ? existing : new CompetitionParticipant();
        p.setCompetitionId(competitionId);
        p.setUser(user);
        p.setStatus(ParticipantStatus.JOINED);
        p.setActive(true);
        p.setJoinedAt(now);
        p.setLeftAt(null);
        p.setDisconnectedAt(null);
        p.setAnsweredCount(0);
        p.setCorrectCount(0);
        p.setScore(0);
        participants.saveAndFlush(p);

        c.setPlayerCount(c.getPlayerCount() + 1);
        c.bumpVersion();
        competitions.saveAndFlush(c);
        events.lobbyUpdated(c, participants.roster(competitionId), hostUsername(c));

        if (c.isFull()) {
            lifecycle.beginCountdown(c, now); // a full lobby starts by itself
        }
        return c;
    }

    /** Leaves the lobby or the countdown. Idempotent. The slot is freed immediately. */
    @Transactional
    public void leave(Long competitionId, Long userId) {
        Competition c = competitions.findByIdForUpdate(competitionId)
                .orElseThrow(() -> new ResourceNotFoundException("Competition not found"));
        CompetitionParticipant p = participants.findByCompetitionIdAndUserId(competitionId, userId)
                .orElseThrow(() -> new ForbiddenException("You are not a participant in this competition"));
        if (p.getStatus() == ParticipantStatus.LEFT) {
            return;
        }
        if (!CompetitionStateMachine.canLeave(c.getStatus())) {
            throw new ConflictException(c.getStatus() == CompetitionStatus.RUNNING
                    ? "The competition is running - press Finish instead of leaving" : "This competition has ended");
        }
        removeMember(c, p);
    }

    /** Removes a member whose connection stayed gone past the grace period. Never throws for stale requests. */
    @Transactional
    public void autoLeave(Long competitionId, Long userId) {
        Competition c = competitions.findByIdForUpdate(competitionId).orElse(null);
        if (c == null || !CompetitionStateMachine.canLeave(c.getStatus())) {
            return;
        }
        CompetitionParticipant p = participants.findByCompetitionIdAndUserId(competitionId, userId).orElse(null);
        if (p == null || p.getStatus() == ParticipantStatus.LEFT || p.getDisconnectedAt() == null) {
            return; // reconnected in the meantime
        }
        log.info("[Competition] {} - removing a member whose connection stayed gone past the grace period", competitionId);
        removeMember(c, p);
    }

    private void removeMember(Competition c, CompetitionParticipant p) {
        Instant now = clock.instant();
        p.setStatus(ParticipantStatus.LEFT);
        p.setActive(false);
        p.setLeftAt(now);
        p.setDisconnectedAt(null);
        participants.saveAndFlush(p);

        c.setPlayerCount(Math.max(0, c.getPlayerCount() - 1));
        if (c.getPlayerCount() == 0) {
            lifecycle.cancel(c, "EMPTY", now);
            return;
        }
        List<CompetitionParticipant> roster = participants.roster(c.getId());
        if (p.getUser().getId().equals(c.getHostId()) && !roster.isEmpty()) {
            c.setHostId(roster.get(0).getUser().getId()); // earliest remaining member becomes the host
        }
        c.bumpVersion();
        competitions.saveAndFlush(c);
        events.lobbyUpdated(c, roster, hostUsername(c, roster));
    }

    /** Host starts the countdown (needs at least the minimum number of players). */
    @Transactional
    public Competition start(Long competitionId, User user) {
        Competition c = competitions.findByIdForUpdate(competitionId)
                .orElseThrow(() -> new ResourceNotFoundException("Competition not found"));
        CompetitionParticipant p = participants.findByCompetitionIdAndUserId(competitionId, user.getId()).orElse(null);
        if (p == null || p.getStatus() == ParticipantStatus.LEFT) {
            throw new ForbiddenException("You are not a participant in this competition");
        }
        if (!user.getId().equals(c.getHostId())) {
            throw new ForbiddenException("Only the host can start the competition");
        }
        if (c.getStatus() != CompetitionStatus.LOBBY) {
            throw new ConflictException("The competition has already started or ended");
        }
        lifecycle.beginCountdown(c, clock.instant());
        return c;
    }

    // ------------------------------------------------------------------ helpers

    private String hostUsername(Competition c) {
        return hostUsername(c, null);
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
