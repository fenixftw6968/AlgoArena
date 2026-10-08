package com.algoarena.security.ratelimit;

import com.algoarena.exception.TooManyRequestsException;
import jakarta.servlet.http.HttpServletRequest;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Clock;
import java.time.Duration;
import java.util.Locale;

/**
 * Brute-force and abuse protection for the authentication endpoints (single-instance, in-memory).
 *
 * <pre>
 *  login            per IP            : N attempts / window          (flood / credential stuffing from one source)
 *                   per account + IP  : N FAILED attempts / window   (password guessing; success clears it)
 *                   per account       : N FAILED attempts / hour     (distributed guessing across many IPs)
 *  signup           per IP            : N / hour                      (mass account creation)
 *  forgot-password  per IP            : N / hour                      (email flooding)
 *                   per e-mail address: N / hour                      (mail-bombing one inbox)
 *  reset-password   per IP            : N / window                    (token guessing / flooding)
 * </pre>
 *
 * Design rules:
 * <ul>
 *   <li>Limits are keyed on what the CLIENT sent (IP, submitted e-mail string) and never on whether an
 *       account exists, so a limit response reveals nothing about account existence.</li>
 *   <li>Rejections are all the same 429 with a generic message and a Retry-After header.</li>
 *   <li>Nothing sensitive is logged: no e-mail, password, token or reset link - only the action and IP.</li>
 *   <li>Account keys are SHA-256 hashed in memory so a heap dump does not list e-mail addresses.</li>
 * </ul>
 */
@Slf4j
@Component
public class AuthRateLimiter {

    static final String GENERIC_MESSAGE = "Too many requests. Please wait a while before trying again.";

    private final SlidingWindowRateLimiter limiter;

    private final boolean enabled;
    private final int loginPerIp;
    private final Duration loginIpWindow;
    private final int loginFailuresPerAccountIp;
    private final Duration loginAccountIpWindow;
    private final int loginFailuresPerAccount;
    private final Duration loginAccountWindow;
    private final int signupPerIp;
    private final Duration signupWindow;
    private final int forgotPerIp;
    private final int forgotPerEmail;
    private final Duration forgotWindow;
    private final int resetPerIp;
    private final Duration resetWindow;

    @Autowired
    public AuthRateLimiter(
            @Value("${security.rate-limit.enabled:true}") boolean enabled,
            @Value("${security.rate-limit.login.per-ip:30}") int loginPerIp,
            @Value("${security.rate-limit.login.ip-window-minutes:10}") int loginIpWindowMinutes,
            @Value("${security.rate-limit.login.failures-per-account-ip:5}") int loginFailuresPerAccountIp,
            @Value("${security.rate-limit.login.account-ip-window-minutes:15}") int loginAccountIpWindowMinutes,
            @Value("${security.rate-limit.login.failures-per-account:20}") int loginFailuresPerAccount,
            @Value("${security.rate-limit.login.account-window-minutes:60}") int loginAccountWindowMinutes,
            @Value("${security.rate-limit.signup.per-ip:5}") int signupPerIp,
            @Value("${security.rate-limit.signup.window-minutes:60}") int signupWindowMinutes,
            @Value("${security.rate-limit.forgot-password.per-ip:10}") int forgotPerIp,
            @Value("${security.rate-limit.forgot-password.per-email:3}") int forgotPerEmail,
            @Value("${security.rate-limit.forgot-password.window-minutes:60}") int forgotWindowMinutes,
            @Value("${security.rate-limit.reset-password.per-ip:10}") int resetPerIp,
            @Value("${security.rate-limit.reset-password.window-minutes:15}") int resetWindowMinutes,
            @Value("${security.rate-limit.max-tracked-keys:50000}") int maxTrackedKeys) {
        this(Clock.systemUTC(), enabled, loginPerIp, loginIpWindowMinutes, loginFailuresPerAccountIp,
                loginAccountIpWindowMinutes, loginFailuresPerAccount, loginAccountWindowMinutes, signupPerIp,
                signupWindowMinutes, forgotPerIp, forgotPerEmail, forgotWindowMinutes, resetPerIp,
                resetWindowMinutes, maxTrackedKeys);
    }

    /** Test constructor with an injectable clock. */
    AuthRateLimiter(Clock clock, boolean enabled, int loginPerIp, int loginIpWindowMinutes,
                    int loginFailuresPerAccountIp, int loginAccountIpWindowMinutes, int loginFailuresPerAccount,
                    int loginAccountWindowMinutes, int signupPerIp, int signupWindowMinutes, int forgotPerIp,
                    int forgotPerEmail, int forgotWindowMinutes, int resetPerIp, int resetWindowMinutes,
                    int maxTrackedKeys) {
        this.limiter = new SlidingWindowRateLimiter(clock, maxTrackedKeys);
        this.enabled = enabled;
        this.loginPerIp = loginPerIp;
        this.loginIpWindow = Duration.ofMinutes(loginIpWindowMinutes);
        this.loginFailuresPerAccountIp = loginFailuresPerAccountIp;
        this.loginAccountIpWindow = Duration.ofMinutes(loginAccountIpWindowMinutes);
        this.loginFailuresPerAccount = loginFailuresPerAccount;
        this.loginAccountWindow = Duration.ofMinutes(loginAccountWindowMinutes);
        this.signupPerIp = signupPerIp;
        this.signupWindow = Duration.ofMinutes(signupWindowMinutes);
        this.forgotPerIp = forgotPerIp;
        this.forgotPerEmail = forgotPerEmail;
        this.forgotWindow = Duration.ofMinutes(forgotWindowMinutes);
        this.resetPerIp = resetPerIp;
        this.resetWindow = Duration.ofMinutes(resetWindowMinutes);
    }

    // ------------------------------------------------------------------ client identification

    /**
     * The client address as resolved by the servlet container. Behind a trusted reverse proxy
     * ({@code server.forward-headers-strategy=native}) Tomcat has already replaced the proxy address with
     * the real client address; X-Forwarded-For is never parsed here, so it cannot be spoofed by callers.
     */
    public static String clientIp(HttpServletRequest request) {
        String ip = request.getRemoteAddr();
        return ip == null || ip.isBlank() ? "unknown" : ip;
    }

    private static String accountKey(String email) {
        String normalised = email == null ? "" : email.trim().toLowerCase(Locale.ROOT);
        try {
            byte[] hash = java.security.MessageDigest.getInstance("SHA-256")
                    .digest(normalised.getBytes(java.nio.charset.StandardCharsets.UTF_8));
            return java.util.HexFormat.of().formatHex(hash, 0, 16);
        } catch (java.security.NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }

    // ------------------------------------------------------------------ login

    /** Call BEFORE verifying credentials. Throws 429 if this source/account is currently blocked. */
    public void checkLogin(String ip, String email) {
        if (!enabled) {
            return;
        }
        String acct = accountKey(email);
        String accountIp = "login:acct-ip:" + acct + ":" + ip;
        String account = "login:acct:" + acct;
        if (limiter.count(accountIp, loginAccountIpWindow) >= loginFailuresPerAccountIp) {
            throw blocked("login", ip, limiter.secondsUntilAvailable(accountIp, loginAccountIpWindow));
        }
        if (limiter.count(account, loginAccountWindow) >= loginFailuresPerAccount) {
            throw blocked("login", ip, limiter.secondsUntilAvailable(account, loginAccountWindow));
        }
        if (!limiter.tryAcquire("login:ip:" + ip, loginPerIp, loginIpWindow)) {
            throw blocked("login", ip, limiter.secondsUntilAvailable("login:ip:" + ip, loginIpWindow));
        }
    }

    public void recordLoginFailure(String ip, String email) {
        if (!enabled) {
            return;
        }
        String acct = accountKey(email);
        limiter.record("login:acct-ip:" + acct + ":" + ip, loginAccountIpWindow);
        limiter.record("login:acct:" + acct, loginAccountWindow);
    }

    public void recordLoginSuccess(String ip, String email) {
        String acct = accountKey(email);
        limiter.reset("login:acct-ip:" + acct + ":" + ip);
    }

    // ------------------------------------------------------------------ signup / reset flow

    public void checkSignup(String ip) {
        if (enabled && !limiter.tryAcquire("signup:ip:" + ip, signupPerIp, signupWindow)) {
            throw blocked("signup", ip, limiter.secondsUntilAvailable("signup:ip:" + ip, signupWindow));
        }
    }

    public void checkForgotPassword(String ip, String email) {
        if (!enabled) {
            return;
        }
        String ipKey = "forgot:ip:" + ip;
        String emailKey = "forgot:email:" + accountKey(email);
        if (limiter.count(emailKey, forgotWindow) >= forgotPerEmail) {
            throw blocked("forgot-password", ip, limiter.secondsUntilAvailable(emailKey, forgotWindow));
        }
        if (!limiter.tryAcquire(ipKey, forgotPerIp, forgotWindow)) {
            throw blocked("forgot-password", ip, limiter.secondsUntilAvailable(ipKey, forgotWindow));
        }
        limiter.record(emailKey, forgotWindow);
    }

    public void checkResetPassword(String ip) {
        if (enabled && !limiter.tryAcquire("reset:ip:" + ip, resetPerIp, resetWindow)) {
            throw blocked("reset-password", ip, limiter.secondsUntilAvailable("reset:ip:" + ip, resetWindow));
        }
    }

    // ------------------------------------------------------------------ housekeeping

    @Scheduled(fixedDelay = 300_000, initialDelay = 300_000)
    void purge() {
        limiter.purgeExpired();
    }

    int trackedKeys() {
        return limiter.trackedKeys();
    }

    private TooManyRequestsException blocked(String action, String ip, long retryAfterSeconds) {
        // Deliberately minimal log: action + source IP only (never e-mail, password, token or reset link).
        log.warn("[RateLimit] {} blocked for ip={} (retry in {}s)", action, ip, retryAfterSeconds);
        return new TooManyRequestsException(GENERIC_MESSAGE, retryAfterSeconds);
    }
}
