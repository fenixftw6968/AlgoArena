package com.algoarena.competition.ws;

import com.algoarena.competition.domain.Competition;
import com.algoarena.competition.domain.CompetitionParticipant;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.time.Clock;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Publishes competition notifications on {@code /topic/competition/{id}}.
 *
 * <ul>
 *   <li><b>After commit only</b>: inside a transaction the send is deferred until the transaction commits, and
 *       dropped if it rolls back, so clients never see state that did not happen.</li>
 *   <li><b>Safe content only</b>: usernames/levels, counts and server timestamps. Never answers, scores of other
 *       players, user ids or e-mails. Anything private is fetched over REST.</li>
 *   <li>Only authorised participants can subscribe (see {@code StompSecurityInterceptor}); clients cannot publish.</li>
 * </ul>
 */
@Slf4j
@Component
@ConditionalOnProperty(prefix = "competition", name = "enabled", havingValue = "true")
public class CompetitionEventPublisher {

    public static final String TOPIC_PREFIX = "/topic/competition/";

    public record Envelope(String type, Long competitionId, long version, Instant serverTime, Object data) {
    }

    private final SimpMessagingTemplate template;
    private final Clock clock;

    public CompetitionEventPublisher(SimpMessagingTemplate template, Clock clock) {
        this.template = template;
        this.clock = clock;
    }

    public void lobbyUpdated(Competition c, List<CompetitionParticipant> roster, String hostUsername) {
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("status", c.getStatus().name());
        data.put("playerCount", c.getPlayerCount());
        data.put("minPlayers", c.getMinPlayers());
        data.put("maxPlayers", c.getMaxPlayers());
        data.put("hostUsername", hostUsername);
        data.put("lobbyDeadlineAt", c.getLobbyDeadlineAt());
        data.put("players", roster.stream().map(p -> {
            Map<String, Object> player = new LinkedHashMap<>();
            player.put("username", p.getUser().getUsername());
            player.put("level", p.getUser().getLevel());
            return player;
        }).toList());
        publish(c, "LOBBY_UPDATED", data);
    }

    public void starting(Competition c) {
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("startTime", c.getStartTime());
        data.put("endTime", c.getEndTime());
        data.put("countdownSeconds", c.getCountdownSeconds());
        data.put("playerCount", c.getPlayerCount());
        publish(c, "COMPETITION_STARTING", data);
    }

    public void started(Competition c) {
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("startTime", c.getStartTime());
        data.put("endTime", c.getEndTime());
        publish(c, "COMPETITION_STARTED", data);
    }

    /** Informational: carries the current competition version (it does not advance it). */
    public void playerFinished(Competition c, String username, long finishedCount, long participantCount) {
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("username", username);
        data.put("finishedCount", finishedCount);
        data.put("participantCount", participantCount);
        publish(c, "PLAYER_FINISHED", data);
    }

    public void ended(Competition c) {
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("finishedAt", c.getFinishedAt());
        publish(c, "COMPETITION_ENDED", data);
    }

    public void cancelled(Competition c) {
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("reason", c.getCancelledReason());
        publish(c, "COMPETITION_CANCELLED", data);
    }

    private void publish(Competition c, String type, Map<String, Object> data) {
        Envelope envelope = new Envelope(type, c.getId(), c.getVersion(), clock.instant(), data);
        Runnable send = () -> {
            try {
                template.convertAndSend(TOPIC_PREFIX + c.getId(), envelope);
            } catch (Exception e) {
                // Notifications are best-effort: REST remains the source of truth.
                log.warn("[Competition] could not publish {} for competition {}: {}", type, c.getId(), e.getClass().getSimpleName());
            }
        };
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    send.run();
                }
            });
        } else {
            send.run();
        }
    }
}
