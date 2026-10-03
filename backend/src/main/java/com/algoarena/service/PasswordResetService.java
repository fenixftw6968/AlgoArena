package com.algoarena.service;

import com.algoarena.dto.ForgotPasswordRequest;
import com.algoarena.dto.ResetPasswordRequest;
import com.algoarena.entity.PasswordResetToken;
import com.algoarena.entity.User;
import com.algoarena.exception.BadRequestException;
import com.algoarena.repository.PasswordResetTokenRepository;
import com.algoarena.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.HexFormat;
import java.util.Optional;

@Slf4j
@Service
@RequiredArgsConstructor
public class PasswordResetService {

    private static final int TOKEN_EXPIRY_MINUTES = 15;
    private static final SecureRandom SECURE_RANDOM = new SecureRandom();

    private final UserRepository userRepository;
    private final PasswordResetTokenRepository resetTokenRepository;
    private final PasswordEncoder passwordEncoder;
    private final EmailService emailService;

    @Value("${app.frontend-url:http://localhost:5173}")
    private String frontendUrl;

    @Transactional
    public void processForgotPassword(ForgotPasswordRequest request) {
        String email = request.getEmail().trim().toLowerCase();
        Optional<User> userOpt = userRepository.findByEmail(email);

        if (userOpt.isEmpty()) {
            log.info("[PasswordReset] Password reset requested for non-existent email: {}", email);
            return;
        }

        User user = userOpt.get();

        // 1. Invalidate any existing active tokens for this user
        resetTokenRepository.invalidateAllActiveTokensForUser(user);

        // 2. Generate cryptographically secure random token (32 bytes = 64 hex chars)
        byte[] randomBytes = new byte[32];
        SECURE_RANDOM.nextBytes(randomBytes);
        String rawToken = HexFormat.of().formatHex(randomBytes);

        // 3. Compute SHA-256 hash of the token for database storage
        String tokenHash = hashToken(rawToken);

        // 4. Save to database with expiry time
        PasswordResetToken resetToken = PasswordResetToken.builder()
                .tokenHash(tokenHash)
                .user(user)
                .expiryDate(LocalDateTime.now().plusMinutes(TOKEN_EXPIRY_MINUTES))
                .used(false)
                .build();

        resetTokenRepository.save(resetToken);

        // 5. Construct secure link with unhashed raw token
        String resetUrl = buildResetUrl(rawToken);

        // 6. Send email via Brevo REST API
        emailService.sendPasswordResetEmail(user.getEmail(), user.getUsername(), resetUrl);
        log.info("[PasswordReset] Reset token generated and email dispatched for user: {}", user.getEmail());
    }

    @Transactional
    public void resetPassword(ResetPasswordRequest request) {
        String rawToken = request.getToken().trim();
        String tokenHash = hashToken(rawToken);

        PasswordResetToken resetToken = resetTokenRepository.findByTokenHash(tokenHash)
                .orElseThrow(() -> new BadRequestException("Invalid or expired password reset link."));

        if (resetToken.isUsed()) {
            throw new BadRequestException("This password reset link has already been used.");
        }

        if (resetToken.getExpiryDate().isBefore(LocalDateTime.now())) {
            throw new BadRequestException("This password reset link has expired. Please request a new one.");
        }

        User user = resetToken.getUser();
        user.setPassword(passwordEncoder.encode(request.getNewPassword()));
        userRepository.save(user);

        // Invalidate token
        resetToken.setUsed(true);
        resetTokenRepository.save(resetToken);

        log.info("[PasswordReset] Password successfully reset for user: {}", user.getEmail());
    }

    private String hashToken(String token) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hashBytes = digest.digest(token.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hashBytes);
        } catch (NoSuchAlgorithmException e) {
            throw new RuntimeException("SHA-256 algorithm not available", e);
        }
    }

    private String buildResetUrl(String rawToken) {
        String base = frontendUrl != null && !frontendUrl.isBlank() ? frontendUrl.replaceAll("/+$", "") : "http://localhost:5173";
        return base + "/reset-password?token=" + rawToken;
    }
}
