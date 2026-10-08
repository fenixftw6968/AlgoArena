package com.algoarena.controller;

import com.algoarena.dto.AuthResponse;
import com.algoarena.dto.LoginRequest;
import com.algoarena.dto.SignupRequest;
import com.algoarena.service.UserService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final com.algoarena.security.ratelimit.AuthRateLimiter rateLimiter;

    private final UserService userService;
    private final com.algoarena.service.PasswordResetService passwordResetService;

    @PostMapping("/signup")
    public ResponseEntity<AuthResponse> signup(@Valid @RequestBody SignupRequest request,
                                               jakarta.servlet.http.HttpServletRequest http) {
        rateLimiter.checkSignup(com.algoarena.security.ratelimit.AuthRateLimiter.clientIp(http));
        return ResponseEntity.ok(userService.register(request));
    }

    @PostMapping("/login")
    public ResponseEntity<AuthResponse> login(@Valid @RequestBody LoginRequest request,
                                              jakarta.servlet.http.HttpServletRequest http) {
        String ip = com.algoarena.security.ratelimit.AuthRateLimiter.clientIp(http);
        // Blocked clients are refused BEFORE any password verification takes place.
        rateLimiter.checkLogin(ip, request.getEmail());
        try {
            AuthResponse response = userService.login(request);
            rateLimiter.recordLoginSuccess(ip, request.getEmail());
            return ResponseEntity.ok(response);
        } catch (com.algoarena.exception.BadRequestException e) {
            rateLimiter.recordLoginFailure(ip, request.getEmail());
            throw e;
        }
    }

    @PostMapping("/forgot-password")
    public ResponseEntity<java.util.Map<String, String>> forgotPassword(@Valid @RequestBody com.algoarena.dto.ForgotPasswordRequest request,
                                                                       jakarta.servlet.http.HttpServletRequest http) {
        // Limits are keyed on the submitted address / IP, never on whether the account exists.
        rateLimiter.checkForgotPassword(com.algoarena.security.ratelimit.AuthRateLimiter.clientIp(http), request.getEmail());
        passwordResetService.processForgotPassword(request);
        return ResponseEntity.ok(java.util.Map.of(
            "message", "If an account with this email exists, a password reset link has been sent."
        ));
    }

    @PostMapping("/reset-password")
    public ResponseEntity<java.util.Map<String, String>> resetPassword(@Valid @RequestBody com.algoarena.dto.ResetPasswordRequest request,
                                                                      jakarta.servlet.http.HttpServletRequest http) {
        rateLimiter.checkResetPassword(com.algoarena.security.ratelimit.AuthRateLimiter.clientIp(http));
        passwordResetService.resetPassword(request);
        return ResponseEntity.ok(java.util.Map.of(
            "message", "Your password has been successfully reset. You can now log in with your new password."
        ));
    }
}
