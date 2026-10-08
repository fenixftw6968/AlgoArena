package com.algoarena.security.ratelimit;

import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import com.algoarena.exception.TooManyRequestsException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.slf4j.LoggerFactory;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.*;

/** P0.10 - limiter mechanics (sliding window, memory bounds, concurrency) and the layered auth policy. */
class RateLimiterTest {

    /** A clock the tests can move forward. */
    static final class TestClock extends Clock {
        private volatile long millis = 1_700_000_000_000L;

        void advance(Duration d) {
            millis += d.toMillis();
        }

        @Override
        public java.time.ZoneId getZone() {
            return ZoneOffset.UTC;
        }

        @Override
        public Clock withZone(java.time.ZoneId zone) {
            return this;
        }

        @Override
        public Instant instant() {
            return Instant.ofEpochMilli(millis);
        }

        @Override
        public long millis() {
            return millis;
        }
    }

    private TestClock clock;

    @BeforeEach
    void setUp() {
        clock = new TestClock();
    }

    // ================================================================== SlidingWindowRateLimiter

    @Test
    void allowsUpToTheLimitThenBlocksAndDoesNotCountBlockedAttempts() {
        SlidingWindowRateLimiter l = new SlidingWindowRateLimiter(clock, 1000);
        Duration w = Duration.ofMinutes(10);

        for (int i = 0; i < 3; i++) {
            assertTrue(l.tryAcquire("k", 3, w), "attempt " + (i + 1));
        }
        assertFalse(l.tryAcquire("k", 3, w));
        assertFalse(l.tryAcquire("k", 3, w));
        assertEquals(3, l.count("k", w), "rejected attempts must not extend the block");
    }

    @Test
    void windowSlidesAndAllowanceReturns() {
        SlidingWindowRateLimiter l = new SlidingWindowRateLimiter(clock, 1000);
        Duration w = Duration.ofMinutes(10);
        l.tryAcquire("k", 2, w);
        clock.advance(Duration.ofMinutes(6));
        l.tryAcquire("k", 2, w);
        assertFalse(l.tryAcquire("k", 2, w));

        clock.advance(Duration.ofMinutes(5)); // first event is now 11 minutes old, second 5
        assertEquals(1, l.count("k", w));
        assertTrue(l.tryAcquire("k", 2, w));
        assertFalse(l.tryAcquire("k", 2, w));
    }

    @Test
    void keysAreIndependent() {
        SlidingWindowRateLimiter l = new SlidingWindowRateLimiter(clock, 1000);
        Duration w = Duration.ofMinutes(1);
        assertTrue(l.tryAcquire("a", 1, w));
        assertFalse(l.tryAcquire("a", 1, w));
        assertTrue(l.tryAcquire("b", 1, w));
    }

    @Test
    void retryAfterIsPositiveAndMatchesTheOldestEvent() {
        SlidingWindowRateLimiter l = new SlidingWindowRateLimiter(clock, 1000);
        Duration w = Duration.ofMinutes(10);
        assertEquals(1, l.secondsUntilAvailable("none", w));
        l.tryAcquire("k", 1, w);
        clock.advance(Duration.ofMinutes(4));

        long retry = l.secondsUntilAvailable("k", w);

        assertTrue(retry >= 359 && retry <= 361, "about 6 minutes left, was " + retry);
    }

    @Test
    void expiredEntriesArePurgedAndMemoryIsBounded() {
        SlidingWindowRateLimiter l = new SlidingWindowRateLimiter(clock, 100);
        Duration w = Duration.ofMinutes(1);
        for (int i = 0; i < 50; i++) {
            l.record("old-" + i, w);
        }
        clock.advance(Duration.ofMinutes(2));
        l.purgeExpired();
        assertEquals(0, l.trackedKeys());

        // an attacker flooding with unique keys cannot grow the table without bound
        for (int i = 0; i < 5_000; i++) {
            l.record("flood-" + i, Duration.ofHours(1));
        }
        assertTrue(l.trackedKeys() <= 100, "tracked keys must stay bounded, was " + l.trackedKeys());
    }

    @Test
    void concurrentAttemptsNeverExceedTheLimit() throws Exception {
        SlidingWindowRateLimiter l = new SlidingWindowRateLimiter(clock, 1000);
        ExecutorService pool = Executors.newFixedThreadPool(16);
        AtomicInteger allowed = new AtomicInteger();
        for (int i = 0; i < 400; i++) {
            pool.submit(() -> {
                if (l.tryAcquire("shared", 25, Duration.ofMinutes(10))) {
                    allowed.incrementAndGet();
                }
            });
        }
        pool.shutdown();
        assertTrue(pool.awaitTermination(10, TimeUnit.SECONDS));
        assertEquals(25, allowed.get());
    }

    // ================================================================== AuthRateLimiter policy

    private AuthRateLimiter limiter() {
        // login: 8/10min per IP, 3 failures per account+IP /15min, 6 per account /60min;
        // signup 2/60min; forgot: 4/ip, 2/email per 60min; reset 3/15min
        return new AuthRateLimiter(clock, true, 8, 10, 3, 15, 6, 60, 2, 60, 4, 2, 60, 3, 15, 1000);
    }

    private static void failLogin(AuthRateLimiter l, String ip, String email) {
        l.checkLogin(ip, email);
        l.recordLoginFailure(ip, email);
    }

    @Test
    void repeatedFailedLoginsLockThatAccountFromThatIpOnly() {
        AuthRateLimiter l = limiter();
        for (int i = 0; i < 3; i++) {
            failLogin(l, "1.1.1.1", "victim@x.com");
        }

        TooManyRequestsException e = assertThrows(TooManyRequestsException.class, () -> l.checkLogin("1.1.1.1", "victim@x.com"));
        assertTrue(e.getRetryAfterSeconds() >= 1);
        assertDoesNotThrow(() -> l.checkLogin("2.2.2.2", "victim@x.com"), "a different source is not locked out");
        assertDoesNotThrow(() -> l.checkLogin("1.1.1.1", "someone-else@x.com"), "a different account is not affected");
    }

    @Test
    void emailMatchingIsCaseAndWhitespaceInsensitive() {
        AuthRateLimiter l = limiter();
        failLogin(l, "1.1.1.1", "Victim@X.com");
        failLogin(l, "1.1.1.1", " victim@x.com ");
        failLogin(l, "1.1.1.1", "VICTIM@x.COM");

        assertThrows(TooManyRequestsException.class, () -> l.checkLogin("1.1.1.1", "victim@x.com"));
    }

    @Test
    void successfulLoginClearsTheFailureCountForThatAccountAndIp() {
        AuthRateLimiter l = limiter();
        failLogin(l, "1.1.1.1", "me@x.com");
        failLogin(l, "1.1.1.1", "me@x.com");
        l.recordLoginSuccess("1.1.1.1", "me@x.com");

        failLogin(l, "1.1.1.1", "me@x.com");
        failLogin(l, "1.1.1.1", "me@x.com");
        assertDoesNotThrow(() -> l.checkLogin("1.1.1.1", "me@x.com"), "only 2 failures since the success");
    }

    @Test
    void lockoutEndsAfterTheWindow() {
        AuthRateLimiter l = limiter();
        for (int i = 0; i < 3; i++) {
            failLogin(l, "1.1.1.1", "me@x.com");
        }
        assertThrows(TooManyRequestsException.class, () -> l.checkLogin("1.1.1.1", "me@x.com"));

        clock.advance(Duration.ofMinutes(16));

        assertDoesNotThrow(() -> l.checkLogin("1.1.1.1", "me@x.com"));
    }

    @Test
    void distributedGuessingAgainstOneAccountIsStoppedAcrossIps() {
        AuthRateLimiter l = limiter();
        for (int i = 0; i < 6; i++) {
            failLogin(l, "10.0.0." + i, "victim@x.com"); // six different sources, one failure each
        }

        assertThrows(TooManyRequestsException.class, () -> l.checkLogin("10.0.0.99", "victim@x.com"));
    }

    @Test
    void loginFloodFromOneIpIsLimitedEvenAcrossManyAccounts() {
        AuthRateLimiter l = limiter();
        for (int i = 0; i < 8; i++) {
            l.checkLogin("9.9.9.9", "user" + i + "@x.com"); // credential stuffing: a new account each time
        }

        assertThrows(TooManyRequestsException.class, () -> l.checkLogin("9.9.9.9", "user99@x.com"));
        assertDoesNotThrow(() -> l.checkLogin("8.8.8.8", "user1@x.com"));
    }

    @Test
    void signupIsLimitedPerIp() {
        AuthRateLimiter l = limiter();
        l.checkSignup("1.1.1.1");
        l.checkSignup("1.1.1.1");

        assertThrows(TooManyRequestsException.class, () -> l.checkSignup("1.1.1.1"));
        assertDoesNotThrow(() -> l.checkSignup("2.2.2.2"));
    }

    @Test
    void forgotPasswordIsLimitedPerAddressAndPerIpRegardlessOfWhetherTheAccountExists() {
        AuthRateLimiter l = limiter();
        l.checkForgotPassword("1.1.1.1", "target@x.com");
        l.checkForgotPassword("2.2.2.2", "TARGET@x.com");   // mail-bombing one inbox from different IPs

        assertThrows(TooManyRequestsException.class, () -> l.checkForgotPassword("3.3.3.3", "target@x.com"));

        // one IP spraying many addresses
        for (int i = 0; i < 4; i++) {
            l.checkForgotPassword("7.7.7.7", "spray" + i + "@x.com");
        }
        assertThrows(TooManyRequestsException.class, () -> l.checkForgotPassword("7.7.7.7", "spray9@x.com"));
    }

    @Test
    void resetPasswordIsLimitedPerIp() {
        AuthRateLimiter l = limiter();
        for (int i = 0; i < 3; i++) {
            l.checkResetPassword("1.1.1.1");
        }

        assertThrows(TooManyRequestsException.class, () -> l.checkResetPassword("1.1.1.1"));
        assertDoesNotThrow(() -> l.checkResetPassword("2.2.2.2"));
    }

    @Test
    void legitimateOccasionalUseIsNeverBlocked() {
        AuthRateLimiter l = limiter();
        for (int day = 0; day < 5; day++) {
            l.checkLogin("1.1.1.1", "me@x.com");
            l.recordLoginSuccess("1.1.1.1", "me@x.com");
            l.checkForgotPassword("1.1.1.1", "me@x.com");
            clock.advance(Duration.ofHours(2));
        }
    }

    @Test
    void disabledLimiterNeverBlocks() {
        AuthRateLimiter l = new AuthRateLimiter(clock, false, 1, 10, 1, 15, 1, 60, 1, 60, 1, 1, 60, 1, 15, 1000);
        for (int i = 0; i < 20; i++) {
            failLogin(l, "1.1.1.1", "me@x.com");
            l.checkSignup("1.1.1.1");
            l.checkForgotPassword("1.1.1.1", "me@x.com");
            l.checkResetPassword("1.1.1.1");
        }
    }

    @Test
    void theRejectionMessageIsGenericAndRevealsNothingAboutTheAccount() {
        AuthRateLimiter l = limiter();
        for (int i = 0; i < 3; i++) {
            failLogin(l, "1.1.1.1", "secret.person@example.com");
        }

        TooManyRequestsException e = assertThrows(TooManyRequestsException.class, () -> l.checkLogin("1.1.1.1", "secret.person@example.com"));

        assertFalse(e.getMessage().toLowerCase().contains("secret.person"));
        assertFalse(e.getMessage().toLowerCase().contains("account"));
        assertFalse(e.getMessage().toLowerCase().contains("password"));
    }

    @Test
    void logsNeverContainEmailsPasswordsOrTokens() {
        Logger logger = (Logger) LoggerFactory.getLogger(AuthRateLimiter.class);
        ListAppender<ILoggingEvent> appender = new ListAppender<>();
        appender.start();
        logger.addAppender(appender);
        try {
            AuthRateLimiter l = limiter();
            for (int i = 0; i < 3; i++) {
                failLogin(l, "1.1.1.1", "private.user@example.com");
            }
            assertThrows(TooManyRequestsException.class, () -> l.checkLogin("1.1.1.1", "private.user@example.com"));
            assertThrows(TooManyRequestsException.class, () -> {
                l.checkForgotPassword("5.5.5.5", "private.user@example.com");
                l.checkForgotPassword("5.5.5.5", "private.user@example.com");
                l.checkForgotPassword("5.5.5.5", "private.user@example.com");
            });
        } finally {
            logger.detachAppender(appender);
        }

        List<String> lines = appender.list.stream().map(ILoggingEvent::getFormattedMessage).toList();
        assertFalse(lines.isEmpty(), "blocked attempts should leave an operator-visible trace");
        for (String line : lines) {
            assertFalse(line.contains("private.user"), line);
            assertFalse(line.contains("@"), line);
            assertTrue(line.contains("ip="), line);
        }
    }

    @Test
    void clientIpComesFromTheContainerNotFromSpoofableHeaders() {
        org.springframework.mock.web.MockHttpServletRequest request = new org.springframework.mock.web.MockHttpServletRequest();
        request.setRemoteAddr("203.0.113.7");
        request.addHeader("X-Forwarded-For", "1.2.3.4");
        request.addHeader("X-Real-IP", "5.6.7.8");

        assertEquals("203.0.113.7", AuthRateLimiter.clientIp(request));
    }
}
