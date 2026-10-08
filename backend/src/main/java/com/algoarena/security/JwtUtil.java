package com.algoarena.security;

import io.jsonwebtoken.*;
import io.jsonwebtoken.io.Decoders;
import io.jsonwebtoken.security.Keys;
import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.util.Date;

@Slf4j
@Component
public class JwtUtil {

    @Value("${jwt.secret}")
    private String secret;

    @Value("${jwt.expiration}")
    private long expiration;

    /** Substrings that identify placeholder / publicly known secrets (found in docs and old configs). */
    private static final String[] FORBIDDEN_SECRET_MARKERS = {
            "mindmaze-super-secret-key", "change-in-production", "replace_with", "changeme", "your_secret",
            "your-secret", "example"
    };

    /** Fail fast at startup instead of running with a weak, missing or publicly known signing secret. */
    @PostConstruct
    void validateSecret() {
        if (secret == null || secret.isBlank() || secret.startsWith("${")) {
            throw new IllegalStateException("jwt.secret is not configured. Set the JWT_SECRET environment variable.");
        }
        if (secret.getBytes(java.nio.charset.StandardCharsets.UTF_8).length < 32) {
            throw new IllegalStateException("jwt.secret is too short: use at least 32 random characters "
                    + "(for example the output of 'openssl rand -base64 48').");
        }
        String lower = secret.toLowerCase(java.util.Locale.ROOT);
        for (String marker : FORBIDDEN_SECRET_MARKERS) {
            if (lower.contains(marker)) {
                throw new IllegalStateException("jwt.secret looks like a placeholder or a publicly known value. "
                        + "Generate a fresh random secret and set JWT_SECRET (see .env.example).");
            }
        }
    }

    private SecretKey getSigningKey() {
        byte[] keyBytes = Decoders.BASE64.decode(
            java.util.Base64.getEncoder().encodeToString(secret.getBytes())
        );
        return Keys.hmacShaKeyFor(keyBytes);
    }

    public String generateToken(String email, Long userId, String username) {
        return Jwts.builder()
            .subject(email)
            .claim("userId",   userId)
            .claim("username", username)
            .issuedAt(new Date())
            .expiration(new Date(System.currentTimeMillis() + expiration))
            .signWith(getSigningKey())
            .compact();
    }

    public String extractEmail(String token) {
        return parseClaims(token).getSubject();
    }

    public Long extractUserId(String token) {
        return parseClaims(token).get("userId", Long.class);
    }

    public boolean isTokenValid(String token) {
        try {
            parseClaims(token);
            return true;
        } catch (JwtException | IllegalArgumentException e) {
            log.warn("Invalid JWT token: {}", e.getMessage());
            return false;
        }
    }

    private Claims parseClaims(String token) {
        return Jwts.parser()
            .verifyWith(getSigningKey())
            .build()
            .parseSignedClaims(token)
            .getPayload();
    }
}
