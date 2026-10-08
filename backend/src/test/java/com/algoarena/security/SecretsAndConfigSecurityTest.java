package com.algoarena.security;

import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import com.algoarena.service.BrevoEmailService;
import org.junit.jupiter.api.Test;
import org.slf4j.LoggerFactory;
import org.springframework.test.util.ReflectionTestUtils;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.regex.Pattern;
import java.util.stream.Stream;

import static org.junit.jupiter.api.Assertions.*;

/**
 * P0.9 - secrets and unsafe configuration.
 *  1. the JWT signing secret is validated at startup (missing / short / placeholder / publicly known),
 *  2. no credential-shaped literal or credential default may live in tracked configuration,
 *  3. password-reset links (which contain the reset token) never reach the logs by default.
 */
class SecretsAndConfigSecurityTest {

    // ------------------------------------------------------------------ 1. JWT secret validation

    private static JwtUtil jwtWithSecret(String secret) {
        JwtUtil util = new JwtUtil();
        ReflectionTestUtils.setField(util, "secret", secret);
        ReflectionTestUtils.setField(util, "expiration", 3600000L);
        return util;
    }

    @Test
    void aStrongRandomSecretIsAccepted() {
        assertDoesNotThrow(() -> jwtWithSecret("k3Jx9QpL2vZr8TnYw5BdHs7MfAe4UcGi6OoXq1NtVb0PzRlKyEaWjSh").validateSecret());
    }

    @Test
    void missingOrUnresolvedSecretsAreRejected() {
        assertThrows(IllegalStateException.class, () -> jwtWithSecret(null).validateSecret());
        assertThrows(IllegalStateException.class, () -> jwtWithSecret("").validateSecret());
        assertThrows(IllegalStateException.class, () -> jwtWithSecret("   ").validateSecret());
        assertThrows(IllegalStateException.class, () -> jwtWithSecret("${JWT_SECRET}").validateSecret());
    }

    @Test
    void shortSecretsAreRejected() {
        assertThrows(IllegalStateException.class, () -> jwtWithSecret("short").validateSecret());
        assertThrows(IllegalStateException.class, () -> jwtWithSecret("a".repeat(31)).validateSecret());
    }

    @Test
    void placeholderAndPubliclyKnownSecretsAreRejected() {
        String[] bad = {
                // the value that used to be committed in docker-compose / .env.example
                "mindmaze-super-secret-key-change-in-production-at-least-64-chars-long-2024",
                "REPLACE_WITH_OUTPUT_OF_openssl_rand_-base64_48",
                "please-changeme-please-changeme-please-changeme",
                "this-is-an-example-secret-this-is-an-example-secret"};
        for (String secret : bad) {
            IllegalStateException e = assertThrows(IllegalStateException.class, () -> jwtWithSecret(secret).validateSecret(), secret);
            assertFalse(e.getMessage().contains(secret), "the error must never echo the secret");
        }
    }

    @Test
    void validationErrorsNeverContainTheSecretValue() {
        String weak = "tooShortSecretValue";
        IllegalStateException e = assertThrows(IllegalStateException.class, () -> jwtWithSecret(weak).validateSecret());
        assertFalse(e.getMessage().contains(weak));
    }

    // ------------------------------------------------------------------ 2. no committed credentials

    /** Credential-shaped literals that must never appear in tracked configuration. */
    private static final List<Pattern> FORBIDDEN = List.of(
            Pattern.compile("npg_[A-Za-z0-9]{8,}"),                       // Neon-style passwords
            Pattern.compile("xkeysib-[0-9a-fA-F]{20,}"),                  // Brevo API keys
            Pattern.compile("AKIA[0-9A-Z]{16}"),                          // AWS access key ids
            Pattern.compile("gh[pousr]_[A-Za-z0-9]{30,}"),                // GitHub tokens
            Pattern.compile("-----BEGIN [A-Z ]*PRIVATE KEY-----"),        // private keys
            Pattern.compile("mindmaze-super-secret-key"),                 // the formerly committed JWT secret
            Pattern.compile("neondb_owner"),                              // production DB role name
            Pattern.compile("[a-z0-9-]+\\.[a-z0-9-]+\\.aws\\.neon\\.tech"), // production DB host
            Pattern.compile("jdbc:postgresql://[^\\s]*:[^\\s@/]+@"));      // credentials embedded in a JDBC URL

    private static final Pattern DEFAULTED_SECRET = Pattern.compile(
            "\\$\\{(DB_URL|DB_USERNAME|DB_PASSWORD|JWT_SECRET|POSTGRES_PASSWORD):[^}]+}");

    private static Path repoRoot() {
        Path here = Path.of("").toAbsolutePath();
        return Files.exists(here.resolve("docker-compose.yml")) ? here : here.getParent();
    }

    private static List<Path> configFiles() throws IOException {
        Path root = repoRoot();
        List<Path> files = new java.util.ArrayList<>(List.of(
                root.resolve("docker-compose.yml"),
                root.resolve(".env.example"),
                root.resolve("backend/.env.example"),
                root.resolve("backend/Dockerfile"),
                root.resolve("frontend/Dockerfile"),
                root.resolve("frontend/nginx.conf"),
                root.resolve("frontend/vercel.json"),
                root.resolve("vercel.json")));
        try (Stream<Path> resources = Files.list(root.resolve("backend/src/main/resources"))) {
            resources.filter(p -> p.getFileName().toString().startsWith("application")).forEach(files::add);
        }
        try (Stream<Path> frontend = Files.walk(root.resolve("frontend/src"))) {
            frontend.filter(Files::isRegularFile)
                    .filter(p -> p.toString().matches(".*\\.(js|jsx)$"))
                    .filter(p -> !p.toString().replace('\\', '/').contains("/src/data/"))
                    .forEach(files::add);
        }
        files.removeIf(p -> !Files.exists(p));
        return files;
    }

    @Test
    void noCredentialShapedLiteralsInTrackedConfiguration() throws IOException {
        for (Path file : configFiles()) {
            String content = Files.readString(file, StandardCharsets.UTF_8);
            for (Pattern pattern : FORBIDDEN) {
                assertFalse(pattern.matcher(content).find(),
                        "credential-shaped literal (" + pattern.pattern() + ") found in " + root().relativize(file));
            }
        }
    }

    private static Path root() {
        return repoRoot();
    }

    @Test
    void secretsInApplicationPropertiesHaveNoDefaultValue() throws IOException {
        Path props = repoRoot().resolve("backend/src/main/resources/application.properties");
        String content = Files.readString(props, StandardCharsets.UTF_8);

        assertFalse(DEFAULTED_SECRET.matcher(content).find(),
                "DB_URL / DB_USERNAME / DB_PASSWORD / JWT_SECRET must not have a fallback default");
        assertTrue(content.contains("spring.datasource.password=${DB_PASSWORD}"));
        assertTrue(content.contains("jwt.secret=${JWT_SECRET}"));
    }

    @Test
    void dockerComposeHasNoLiteralCredentialsAndNoImplicitProductionDatabase() throws IOException {
        String compose = Files.readString(repoRoot().resolve("docker-compose.yml"), StandardCharsets.UTF_8);

        for (String key : List.of("DB_URL", "DB_USERNAME", "DB_PASSWORD", "JWT_SECRET")) {
            assertTrue(compose.contains("${" + key + ":?"), key + " must be a required variable supplied from .env");
        }
        assertFalse(Pattern.compile("(?m)^\\s*-?\\s*(DB_PASSWORD|JWT_SECRET|POSTGRES_PASSWORD)\\s*[:=]\\s*[^$\\s#]").matcher(compose).find(),
                "no literal password / secret values in docker-compose.yml");
        assertFalse(compose.toLowerCase().contains("neon"), "compose must not reference a hosted database");
    }

    @Test
    void realEnvFilesAreIgnoredByGitButTheExampleIsNot() throws IOException {
        String gitignore = Files.readString(repoRoot().resolve(".gitignore"), StandardCharsets.UTF_8);

        assertTrue(Pattern.compile("(?m)^\\.env\\s*$").matcher(gitignore).find());
        assertTrue(gitignore.contains("!.env.example"));
    }

    @Test
    void exampleFilesContainOnlyObviousPlaceholders() throws IOException {
        for (String name : List.of(".env.example", "backend/.env.example")) {
            String content = Files.readString(repoRoot().resolve(name), StandardCharsets.UTF_8);
            assertTrue(content.contains("REPLACE_WITH"), name + " must use an unmistakable JWT placeholder");
            assertFalse(Pattern.compile("(?m)^JWT_SECRET=(?!REPLACE_WITH).{20,}$").matcher(content).find(),
                    name + " must not carry a realistic-looking JWT secret");
        }
    }

    // ------------------------------------------------------------------ 3. nothing sensitive in logs

    private static final String RESET_URL = "https://app.example.com/reset-password?token=SUPER-SECRET-RESET-TOKEN";

    private List<ILoggingEvent> captureLogs(boolean devLogResetLinks) {
        Logger logger = (Logger) LoggerFactory.getLogger(BrevoEmailService.class);
        ListAppender<ILoggingEvent> appender = new ListAppender<>();
        appender.start();
        logger.addAppender(appender);
        try {
            BrevoEmailService service = new BrevoEmailService();
            ReflectionTestUtils.setField(service, "brevoApiKey", "");           // provider not configured
            ReflectionTestUtils.setField(service, "devLogResetLinks", devLogResetLinks);
            service.sendPasswordResetEmail("user@example.com", "User", RESET_URL);
            return List.copyOf(appender.list);
        } finally {
            logger.detachAppender(appender);
        }
    }

    @Test
    void resetLinkAndTokenAreNeverLoggedByDefault() {
        List<ILoggingEvent> events = captureLogs(false);

        assertFalse(events.isEmpty(), "operators should still be told that no email was sent");
        for (ILoggingEvent event : events) {
            String text = event.getFormattedMessage();
            assertFalse(text.contains("SUPER-SECRET-RESET-TOKEN"), text);
            assertFalse(text.contains("reset-password?token"), text);
        }
    }

    @Test
    void resetLinkIsOnlyLoggedWhenExplicitlyEnabledForLocalDevelopment() {
        String text = String.join("\n", captureLogs(true).stream().map(ILoggingEvent::getFormattedMessage).toList());

        assertTrue(text.contains("SUPER-SECRET-RESET-TOKEN"));
    }
}
