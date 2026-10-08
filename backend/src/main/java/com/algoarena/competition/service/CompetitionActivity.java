package com.algoarena.competition.service;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;

/**
 * In-memory hint that lets the 1-second lifecycle ticker stay completely idle (no database queries, so a
 * serverless database can sleep) when no competition is live. It is only a hint: it is re-verified against the
 * database at least every 30 seconds, so a missed signal can never strand a competition.
 */
@Component
@ConditionalOnProperty(prefix = "competition", name = "enabled", havingValue = "true")
public class CompetitionActivity {

    private static final Duration SAFETY_CHECK = Duration.ofSeconds(30);

    private final Clock clock;
    private volatile boolean maybeLive = true;
    private volatile Instant lastCheck = Instant.EPOCH;

    public CompetitionActivity(Clock clock) {
        this.clock = clock;
    }

    /** Call whenever a competition is created or becomes live. */
    public void markActive() {
        maybeLive = true;
    }

    public boolean shouldPoll() {
        return maybeLive || Duration.between(lastCheck, clock.instant()).compareTo(SAFETY_CHECK) >= 0;
    }

    public void recordCheck(boolean anyLive) {
        lastCheck = clock.instant();
        maybeLive = anyLive;
    }
}
