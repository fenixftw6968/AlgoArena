package com.algoarena.competition.support;

import com.algoarena.competition.config.CompetitionProperties;
import com.algoarena.entity.User;
import com.algoarena.repository.UserRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import static org.mockito.Mockito.reset;

/**
 * Base for tests that need the real database behaviour (row locks, constraints, partial indexes). Every test
 * starts from empty tables and a fixed clock.
 */
@SpringBootTest(classes = CompetitionDbTestConfig.class, webEnvironment = SpringBootTest.WebEnvironment.NONE, properties = {
        "competition.enabled=true",
        "spring.jpa.hibernate.ddl-auto=create",
        "spring.jpa.open-in-view=false",
        "spring.jpa.show-sql=false",
        "logging.level.org.hibernate.SQL=OFF"
})
public abstract class AbstractCompetitionDbTest {

    @DynamicPropertySource
    static void database(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", EmbeddedPgHolder::jdbcUrl);
        registry.add("spring.datasource.username", () -> "postgres");
        registry.add("spring.datasource.password", () -> "postgres");
        registry.add("spring.datasource.driver-class-name", () -> "org.postgresql.Driver");
    }

    @Autowired protected JdbcTemplate jdbc;
    @Autowired protected UserRepository users;
    @Autowired protected MutableClock clock;
    @Autowired protected CompetitionProperties props;
    @Autowired protected SimpMessagingTemplate stomp;

    private int userCounter = 0;

    @BeforeEach
    void cleanDatabaseAndResetSettings() {
        jdbc.execute("TRUNCATE competition_submissions, competition_questions, competition_participants, competitions, users RESTART IDENTITY CASCADE");
        clock.set(java.time.Instant.parse("2026-06-01T12:00:00Z"));
        props.setMinPlayers(2);
        props.setMaxPlayers(25);
        props.setQuestionCount(10);
        props.setDurationSeconds(1200);
        props.setCountdownSeconds(10);
        props.setLobbyTtlSeconds(600);
        props.setDisconnectGraceSeconds(30);
        props.setFinalizeDelayMs(1500);
        props.setSubmissionGraceMs(0);
        reset(stomp);
    }

    @AfterEach
    void noop() {
        // placeholder so subclasses can add @AfterEach without ordering surprises
    }

    protected User newUser(String name) {
        userCounter++;
        return users.save(User.builder().username(name + "-" + userCounter).email(name + userCounter + "@test.local").password("x").build());
    }

    protected List<User> newUsers(int count) {
        List<User> list = new ArrayList<>();
        for (int i = 0; i < count; i++) {
            list.add(newUser("player"));
        }
        return list;
    }

    protected void advance(long seconds) {
        clock.advance(Duration.ofSeconds(seconds));
    }

    /** Runs all tasks at the same instant (released together by a latch) and returns their outcomes. */
    protected <T> List<Outcome<T>> runConcurrently(List<Callable<T>> tasks) throws Exception {
        ExecutorService pool = Executors.newFixedThreadPool(tasks.size());
        CountDownLatch ready = new CountDownLatch(tasks.size());
        CountDownLatch go = new CountDownLatch(1);
        List<Future<Outcome<T>>> futures = new ArrayList<>();
        for (Callable<T> task : tasks) {
            futures.add(pool.submit(() -> {
                ready.countDown();
                go.await();
                try {
                    return new Outcome<>(task.call(), null);
                } catch (Throwable t) {
                    return new Outcome<>(null, t);
                }
            }));
        }
        ready.await(10, TimeUnit.SECONDS);
        go.countDown();
        List<Outcome<T>> outcomes = new ArrayList<>();
        for (Future<Outcome<T>> f : futures) {
            try {
                outcomes.add(f.get(60, TimeUnit.SECONDS));
            } catch (ExecutionException e) {
                outcomes.add(new Outcome<>(null, e.getCause()));
            }
        }
        pool.shutdown();
        return outcomes;
    }

    public record Outcome<T>(T value, Throwable error) {
        public boolean ok() {
            return error == null;
        }
    }
}
