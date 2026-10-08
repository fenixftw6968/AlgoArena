package com.algoarena.competition.service;

import com.algoarena.exception.TooManyRequestsException;
import com.algoarena.security.ratelimit.SlidingWindowRateLimiter;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.time.Clock;
import java.time.Duration;

/**
 * Per-user abuse limits for the competition endpoints (single-instance, in memory - the same trade-off as the
 * authentication limiter). The limits are far above anything a real player reaches; they only stop scripted
 * flooding. The database constraints, not these limits, are what guarantee correctness.
 */
@Slf4j
@Component
@ConditionalOnProperty(prefix = "competition", name = "enabled", havingValue = "true")
public class CompetitionRateLimiter {

    private static final String MESSAGE = "Too many requests. Please slow down.";

    private final SlidingWindowRateLimiter limiter;

    public CompetitionRateLimiter(Clock clock) {
        this.limiter = new SlidingWindowRateLimiter(clock, 20_000);
    }

    public void checkCreate(Long userId) {
        check("create", userId, 3, Duration.ofHours(1));
    }

    public void checkJoin(Long userId) {
        check("join", userId, 30, Duration.ofMinutes(1));
    }

    public void checkStart(Long userId) {
        check("start", userId, 10, Duration.ofMinutes(1));
    }

    public void checkSubmit(Long userId) {
        check("submit", userId, 240, Duration.ofMinutes(1));
    }

    public void checkFinish(Long userId) {
        check("finish", userId, 20, Duration.ofMinutes(1));
    }

    private void check(String action, Long userId, int limit, Duration window) {
        String key = action + ":" + userId;
        if (!limiter.tryAcquire(key, limit, window)) {
            long retry = limiter.secondsUntilAvailable(key, window);
            log.warn("[Competition] rate limit hit: action={}", action);
            throw new TooManyRequestsException(MESSAGE, retry);
        }
    }
}
