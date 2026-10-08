package com.algoarena.controller;

import com.algoarena.config.SecurityConfig;
import com.algoarena.dto.AuthResponse;
import com.algoarena.exception.BadRequestException;
import com.algoarena.repository.UserRepository;
import com.algoarena.security.JwtAuthFilter;
import com.algoarena.security.JwtUtil;
import com.algoarena.security.ratelimit.AuthRateLimiter;
import com.algoarena.service.PasswordResetService;
import com.algoarena.service.UserService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * P0.10 - the rate limits as seen over HTTP: first requests behave normally, abusive ones get 429 with
 * Retry-After and a generic body, blocked requests never reach password verification / e-mail sending,
 * and nothing reveals whether an account exists.
 */
@WebMvcTest(AuthController.class)
@Import({SecurityConfig.class, JwtAuthFilter.class, AuthRateLimiter.class})
@TestPropertySource(properties = {
        "cors.allowed-origins=http://localhost:5173",
        "security.rate-limit.login.failures-per-account-ip=3",
        "security.rate-limit.login.per-ip=12",
        "security.rate-limit.signup.per-ip=2",
        "security.rate-limit.forgot-password.per-ip=4",
        "security.rate-limit.forgot-password.per-email=2",
        "security.rate-limit.reset-password.per-ip=3"})
class AuthRateLimitingHttpTest {

    @Autowired private MockMvc mockMvc;
    @MockBean private UserService userService;
    @MockBean private PasswordResetService passwordResetService;
    @MockBean private JwtUtil jwtUtil;
    @MockBean private UserRepository userRepository;

    @BeforeEach
    void setUp() {
        when(userService.login(any())).thenAnswer(inv -> {
            var req = (com.algoarena.dto.LoginRequest) inv.getArgument(0);
            if ("correct-password".equals(req.getPassword())) {
                return new AuthResponse("jwt", null);
            }
            throw new BadRequestException("Invalid email or password");
        });
    }

    private static RequestPostProcessor from(String ip) {
        return request -> {
            request.setRemoteAddr(ip);
            return request;
        };
    }

    private ResultActions login(String email, String password, String ip) throws Exception {
        return mockMvc.perform(post("/api/auth/login").with(from(ip)).contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"" + email + "\",\"password\":\"" + password + "\"}"));
    }

    private ResultActions forgot(String email, String ip) throws Exception {
        return mockMvc.perform(post("/api/auth/forgot-password").with(from(ip)).contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"" + email + "\"}"));
    }

    // ------------------------------------------------------------------ login brute force

    @Test
    void bruteForceLoginIsStoppedAndBlockedAttemptsNeverReachPasswordChecking() throws Exception {
        for (int i = 0; i < 3; i++) {
            login("victim@example.com", "guess" + i, "198.51.100.1").andExpect(status().isBadRequest());
        }
        clearInvocations(userService);

        login("victim@example.com", "correct-password", "198.51.100.1")   // even the RIGHT password is refused while blocked
                .andExpect(status().isTooManyRequests())
                .andExpect(header().exists("Retry-After"))
                .andExpect(jsonPath("$.status").value(429))
                .andExpect(jsonPath("$.message").value("Too many requests. Please wait a while before trying again."));
        verifyNoInteractions(userService);
    }

    @Test
    void rotatingTheForwardedForHeaderDoesNotEvadeTheLimit() throws Exception {
        for (int i = 0; i < 3; i++) {
            mockMvc.perform(post("/api/auth/login").with(from("198.51.100.9"))
                            .header("X-Forwarded-For", "10.9.8." + i)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"email\":\"spoof@example.com\",\"password\":\"bad" + i + "\"}"))
                    .andExpect(status().isBadRequest());
        }

        mockMvc.perform(post("/api/auth/login").with(from("198.51.100.9"))
                        .header("X-Forwarded-For", "77.77.77.77")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"spoof@example.com\",\"password\":\"bad\"}"))
                .andExpect(status().isTooManyRequests());
    }

    @Test
    void otherUsersAndSourcesAreNotAffectedBySomeonesBruteForce() throws Exception {
        for (int i = 0; i < 3; i++) {
            login("victim2@example.com", "guess" + i, "198.51.100.2").andExpect(status().isBadRequest());
        }
        login("victim2@example.com", "x", "198.51.100.2").andExpect(status().isTooManyRequests());

        login("victim2@example.com", "correct-password", "203.0.113.50").andExpect(status().isOk());   // real owner elsewhere
        login("different@example.com", "correct-password", "198.51.100.2").andExpect(status().isOk()); // same IP, other account
    }

    @Test
    void legitimateLoginWithATypoThenSuccessIsFine() throws Exception {
        login("typo@example.com", "wrong", "192.0.2.10").andExpect(status().isBadRequest());
        login("typo@example.com", "correct-password", "192.0.2.10").andExpect(status().isOk());
        login("typo@example.com", "correct-password", "192.0.2.10").andExpect(status().isOk());
    }

    @Test
    void wrongPasswordAndUnknownAccountAreIndistinguishableToTheClient() throws Exception {
        String wrongPassword = login("exists@example.com", "bad", "192.0.2.20").andExpect(status().isBadRequest())
                .andReturn().getResponse().getContentAsString().replaceAll("\"timestamp\":\"[^\"]*\",?", "");
        String unknownAccount = login("nobody-here@example.com", "bad", "192.0.2.21").andExpect(status().isBadRequest())
                .andReturn().getResponse().getContentAsString().replaceAll("\"timestamp\":\"[^\"]*\",?", "");

        org.junit.jupiter.api.Assertions.assertEquals(wrongPassword, unknownAccount);
    }

    // ------------------------------------------------------------------ password-reset abuse

    @Test
    void forgotPasswordIsLimitedPerAddressAndTheLimitedResponseIsTheSameForRealAndFakeAccounts() throws Exception {
        forgot("real@example.com", "192.0.2.30").andExpect(status().isOk());
        forgot("real@example.com", "192.0.2.31").andExpect(status().isOk());
        forgot("real@example.com", "192.0.2.32").andExpect(status().isTooManyRequests());

        forgot("ghost@example.com", "192.0.2.40").andExpect(status().isOk());
        forgot("ghost@example.com", "192.0.2.41").andExpect(status().isOk());
        forgot("ghost@example.com", "192.0.2.42").andExpect(status().isTooManyRequests());
    }

    @Test
    void forgotPasswordFloodFromOneIpIsStopped() throws Exception {
        for (int i = 0; i < 4; i++) {
            forgot("victim" + i + "@example.com", "192.0.2.50").andExpect(status().isOk());
        }
        clearInvocations(passwordResetService);

        forgot("another@example.com", "192.0.2.50")
                .andExpect(status().isTooManyRequests())
                .andExpect(header().exists("Retry-After"));
        verifyNoInteractions(passwordResetService); // no more e-mails are generated once blocked
    }

    @Test
    void normalForgotPasswordResponseIsTheGenericOne() throws Exception {
        forgot("someone@example.com", "192.0.2.60")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("If an account with this email exists, a password reset link has been sent."));
    }

    @Test
    void resetPasswordAttemptsAreLimitedPerIp() throws Exception {
        String body = "{\"token\":\"" + "a".repeat(64) + "\",\"newPassword\":\"Sup3rSecret!\"}";
        for (int i = 0; i < 3; i++) {
            mockMvc.perform(post("/api/auth/reset-password").with(from("192.0.2.70"))
                    .contentType(MediaType.APPLICATION_JSON).content(body)).andExpect(status().isOk());
        }
        clearInvocations(passwordResetService);

        mockMvc.perform(post("/api/auth/reset-password").with(from("192.0.2.70"))
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isTooManyRequests());
        verifyNoInteractions(passwordResetService);
    }

    // ------------------------------------------------------------------ signup spam

    @Test
    void signupSpamIsLimitedPerIp() throws Exception {
        String body = "{\"username\":\"newuser\",\"email\":\"new@example.com\",\"password\":\"Passw0rd!\"}";
        for (int i = 0; i < 2; i++) {
            mockMvc.perform(post("/api/auth/signup").with(from("192.0.2.80"))
                    .contentType(MediaType.APPLICATION_JSON).content(body)).andExpect(status().isOk());
        }

        mockMvc.perform(post("/api/auth/signup").with(from("192.0.2.80"))
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isTooManyRequests());
        mockMvc.perform(post("/api/auth/signup").with(from("192.0.2.81"))
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isOk());
    }

    // ------------------------------------------------------------------ the limiter does not guard the rest of the API

    @Test
    void invalidPayloadsStillGetNormalValidationErrors() throws Exception {
        mockMvc.perform(post("/api/auth/login").with(from("192.0.2.90"))
                        .contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isBadRequest());
    }
}
