package com.algoarena.competition.support;

import io.zonky.test.db.postgres.embedded.EmbeddedPostgres;

import java.io.IOException;

/**
 * One real, throw-away PostgreSQL server per test JVM (no Docker needed). It lives in a temp directory and is
 * destroyed on exit. NOTHING in the competition tests ever connects to any other database.
 */
public final class EmbeddedPgHolder {

    private static final EmbeddedPostgres PG;

    static {
        try {
            PG = EmbeddedPostgres.builder().start();
        } catch (IOException e) {
            throw new IllegalStateException("Could not start the embedded PostgreSQL used by the competition tests", e);
        }
        Runtime.getRuntime().addShutdownHook(new Thread(() -> {
            try {
                PG.close();
            } catch (Exception ignored) {
                // best effort
            }
        }));
    }

    private EmbeddedPgHolder() {
    }

    public static String jdbcUrl() {
        return PG.getJdbcUrl("postgres", "postgres");
    }

    public static int port() {
        return PG.getPort();
    }
}
