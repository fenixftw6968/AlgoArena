package com.algoarena.competition.config;

import jakarta.annotation.PostConstruct;
import lombok.Getter;
import lombok.Setter;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * Competition settings. Everything is configurable via {@code competition.*} properties / environment
 * variables, and a snapshot of the limits is copied into each competition row at creation so a running
 * contest is never affected by later configuration changes.
 *
 * <p>The whole feature is OFF unless {@code competition.enabled=true} (env {@code COMPETITION_ENABLED}).
 * Turn it on only after the SQL in {@code db/competition/001_create_competition_tables.sql} has been applied.
 */
@Getter
@Setter
@Component
@ConditionalOnProperty(prefix = "competition", name = "enabled", havingValue = "true")
public class CompetitionProperties {

    /** Hard product cap, mirrored by a CHECK constraint in the database. */
    public static final int HARD_MAX_PLAYERS = 25;

    @Value("${competition.enabled:false}")
    private boolean enabled = false;

    @Value("${competition.min-players:2}")
    private int minPlayers = 2;

    @Value("${competition.max-players:25}")
    private int maxPlayers = HARD_MAX_PLAYERS;

    @Value("${competition.question-count:10}")
    private int questionCount = 10;

    @Value("${competition.duration-seconds:1200}")
    private int durationSeconds = 1200;

    @Value("${competition.countdown-seconds:10}")
    private int countdownSeconds = 10;

    /** How long a lobby may wait before it starts (if the minimum is met) or is cancelled. */
    @Value("${competition.lobby-ttl-seconds:600}")
    private int lobbyTtlSeconds = 600;

    /** A lobby/countdown member whose connection is gone for this long is removed (frees the slot). */
    @Value("${competition.disconnect-grace-seconds:30}")
    private int disconnectGraceSeconds = 30;

    /** After end time, wait this long before ranking so in-flight submissions can drain. */
    @Value("${competition.finalize-delay-ms:1500}")
    private long finalizeDelayMs = 1500;

    /** Network allowance added to the end time for submissions that were already in flight. 0 = strict. */
    @Value("${competition.submission-grace-ms:0}")
    private long submissionGraceMs = 0;

    /** Easy,Medium,Hard counts. If they do not add up to questionCount they are scaled. */
    @Value("${competition.difficulty-mix:3,4,3}")
    private String difficultyMix = "3,4,3";

    @Value("${competition.max-per-category:2}")
    private int maxPerCategory = 2;

    @PostConstruct
    public void validate() {
        if (minPlayers < 2) {
            throw new IllegalStateException("competition.min-players must be at least 2");
        }
        if (maxPlayers > HARD_MAX_PLAYERS || maxPlayers < minPlayers) {
            throw new IllegalStateException("competition.max-players must be between min-players and " + HARD_MAX_PLAYERS);
        }
        if (questionCount < 1 || questionCount > 50) {
            throw new IllegalStateException("competition.question-count must be between 1 and 50");
        }
        if (durationSeconds < 10 || countdownSeconds < 0 || lobbyTtlSeconds < 1) {
            throw new IllegalStateException("competition durations are invalid");
        }
    }
}
