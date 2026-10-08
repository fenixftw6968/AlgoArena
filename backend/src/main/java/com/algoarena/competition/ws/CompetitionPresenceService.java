package com.algoarena.competition.ws;

import com.algoarena.competition.domain.CompetitionStatus;
import com.algoarena.competition.repository.CompetitionParticipantRepository;
import com.algoarena.security.StompSecurityInterceptor.StompUser;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.socket.messaging.SessionConnectedEvent;
import org.springframework.web.socket.messaging.SessionDisconnectEvent;

import java.time.Clock;
import java.util.EnumSet;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Tracks which users currently have at least one live WebSocket session.
 *
 * <p>Presence only ever matters for ONE thing: a lobby/countdown member whose connection stays gone past the
 * grace period is removed so a ghost cannot hold one of the 25 slots (done by the ticker via
 * {@code disconnected_at}). It NEVER affects a running competition: scores, answers and the right to keep
 * answering over REST are untouched by a disconnect. Identity is the user, not the socket, so two tabs are fine.
 *
 * <p>State is in memory (single instance). On start-up every lobby member gets a fresh grace period, because
 * their sockets died with the previous process.
 */
@Slf4j
@Component
@ConditionalOnProperty(prefix = "competition", name = "enabled", havingValue = "true")
public class CompetitionPresenceService {

    private static final Set<CompetitionStatus> LOBBY_STATES = EnumSet.of(CompetitionStatus.LOBBY, CompetitionStatus.STARTING);

    private final CompetitionParticipantRepository participants;
    private final TransactionTemplate tx;
    private final Clock clock;

    private final ConcurrentHashMap<Long, Set<String>> sessionsByUser = new ConcurrentHashMap<>();

    public CompetitionPresenceService(CompetitionParticipantRepository participants, TransactionTemplate tx, Clock clock) {
        this.participants = participants;
        this.tx = tx;
        this.clock = clock;
    }

    @EventListener
    public void onConnected(SessionConnectedEvent event) {
        if (!(event.getUser() instanceof StompUser user)) {
            return;
        }
        String sessionId = StompHeaderAccessor.wrap(event.getMessage()).getSessionId();
        Set<String> sessions = sessionsByUser.computeIfAbsent(user.userId(), id -> ConcurrentHashMap.newKeySet());
        boolean first = sessions.isEmpty();
        sessions.add(sessionId);
        if (first) {
            touch(user.userId());
        }
    }

    @EventListener
    public void onDisconnected(SessionDisconnectEvent event) {
        if (!(event.getUser() instanceof StompUser user)) {
            return;
        }
        Set<String> sessions = sessionsByUser.get(user.userId());
        if (sessions == null) {
            return;
        }
        sessions.remove(event.getSessionId());
        if (sessions.isEmpty()) {
            sessionsByUser.remove(user.userId(), sessions);
            try {
                tx.executeWithoutResult(s -> participants.markDisconnected(user.userId(), clock.instant(), LOBBY_STATES));
            } catch (Exception e) {
                log.warn("[Competition] could not record disconnect: {}", e.getClass().getSimpleName());
            }
        }
    }

    /** The user is demonstrably present (WebSocket connected or a REST call): clear any pending removal. */
    public void touch(Long userId) {
        try {
            tx.executeWithoutResult(s -> participants.clearDisconnected(userId));
        } catch (Exception e) {
            log.warn("[Competition] could not clear disconnect marker: {}", e.getClass().getSimpleName());
        }
    }

    public boolean isConnected(Long userId) {
        Set<String> sessions = sessionsByUser.get(userId);
        return sessions != null && !sessions.isEmpty();
    }

    @EventListener(ApplicationReadyEvent.class)
    public void onStartup() {
        try {
            int marked = tx.execute(s -> participants.markAllLobbyMembersDisconnected(clock.instant(),
                    com.algoarena.competition.domain.ParticipantStatus.JOINED, LOBBY_STATES));
            if (marked > 0) {
                log.info("[Competition] {} lobby member(s) get a fresh reconnect grace period after start-up", marked);
            }
        } catch (Exception e) {
            log.warn("[Competition] start-up presence reset skipped ({}). Is the competition schema applied?", e.getClass().getSimpleName());
        }
    }
}
