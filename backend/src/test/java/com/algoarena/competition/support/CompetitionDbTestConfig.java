package com.algoarena.competition.support;

import com.algoarena.competition.config.CompetitionConfig;
import org.springframework.beans.factory.SmartInitializingSingleton;
import org.springframework.boot.autoconfigure.EnableAutoConfiguration;
import org.springframework.boot.autoconfigure.domain.EntityScan;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.ComponentScan;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.FilterType;
import org.springframework.core.io.FileSystemResource;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;
import org.springframework.jdbc.datasource.init.ScriptUtils;
import org.springframework.messaging.simp.SimpMessagingTemplate;

import javax.sql.DataSource;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.Statement;

import static org.mockito.Mockito.mock;

/**
 * Slim application context for database-backed competition tests: all JPA entities and repositories, the whole
 * competition package, a controllable clock and a mocked STOMP template.
 *
 * <p>Schema: Hibernate creates the NON-competition tables (users, ...) it needs; the four competition tables
 * are then dropped and created from the REAL SQL script {@code db/competition/001_create_competition_tables.sql},
 * so the tests exercise exactly what will run in production (partial unique indexes, CHECKs, composite FKs).
 */
@Configuration
@EnableAutoConfiguration
@EntityScan(basePackages = "com.algoarena")
@EnableJpaRepositories(basePackages = "com.algoarena")
@ComponentScan(basePackages = "com.algoarena.competition",
        excludeFilters = @ComponentScan.Filter(type = FilterType.ASSIGNABLE_TYPE, classes = CompetitionConfig.class))
public class CompetitionDbTestConfig {

    @Bean
    public static EmbeddedDbGuard embeddedDbGuard() {
        return new EmbeddedDbGuard();
    }

    @Bean
    public MutableClock mutableClock() {
        return new MutableClock();
    }

    @Bean
    public SimpMessagingTemplate simpMessagingTemplate() {
        return mock(SimpMessagingTemplate.class);
    }

    static Path sqlScript() {
        Path here = Path.of("").toAbsolutePath();
        Path root = Files.exists(here.resolve("db")) ? here : here.getParent();
        return root.resolve("db/competition/001_create_competition_tables.sql");
    }

    @Bean
    public SmartInitializingSingleton competitionSchema(DataSource dataSource) {
        return () -> {
            try (Connection c = dataSource.getConnection(); Statement st = c.createStatement()) {
                st.execute("DROP TABLE IF EXISTS competition_submissions, competition_questions, competition_participants, competitions CASCADE");
                ScriptUtils.executeSqlScript(c, new FileSystemResource(sqlScript()));
            } catch (Exception e) {
                throw new IllegalStateException("Could not apply the competition SQL script", e);
            }
        };
    }
}
