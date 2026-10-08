package com.algoarena.config;

import java.net.URI;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

/**
 * Builds the single list of trusted browser origins used by BOTH the HTTP CORS configuration and the
 * WebSocket/SockJS origin check, so the two can never drift apart.
 *
 * <p>Rules (fail fast at startup rather than silently trusting too much):
 * <ul>
 *   <li>only exact origins ({@code scheme://host[:port]}) - wildcards are rejected;</li>
 *   <li>trailing slashes / paths are normalised away;</li>
 *   <li>the configured frontend URL ({@code app.frontend-url}) is always trusted, because the backend
 *       already links users to it (password-reset emails).</li>
 * </ul>
 */
public final class AllowedOrigins {

    private AllowedOrigins() {
    }

    /**
     * @param csv         comma separated origins from {@code cors.allowed-origins}
     * @param frontendUrl the configured frontend URL (may be blank)
     */
    public static List<String> resolve(String csv, String frontendUrl) {
        Set<String> origins = new LinkedHashSet<>();
        if (csv != null) {
            for (String raw : csv.split(",")) {
                if (!raw.isBlank()) {
                    origins.add(normalise(raw));
                }
            }
        }
        if (frontendUrl != null && !frontendUrl.isBlank()) {
            origins.add(normalise(frontendUrl));
        }
        return new ArrayList<>(origins);
    }

    static String normalise(String raw) {
        String value = raw.trim();
        if (value.contains("*")) {
            throw new IllegalStateException("Wildcard CORS origins are not allowed: '" + value + "'. "
                    + "List each trusted frontend origin explicitly in CORS_ALLOWED_ORIGINS.");
        }
        URI uri;
        try {
            uri = URI.create(value);
        } catch (IllegalArgumentException e) {
            throw new IllegalStateException("Invalid CORS origin: '" + value + "'");
        }
        String scheme = uri.getScheme() == null ? "" : uri.getScheme().toLowerCase(Locale.ROOT);
        if ((!scheme.equals("http") && !scheme.equals("https")) || uri.getHost() == null) {
            throw new IllegalStateException("CORS origin must look like https://host[:port]: '" + value + "'");
        }
        StringBuilder origin = new StringBuilder(scheme).append("://").append(uri.getHost().toLowerCase(Locale.ROOT));
        if (uri.getPort() != -1) {
            origin.append(':').append(uri.getPort());
        }
        return origin.toString();
    }
}
