package com.algoarena.competition;

import com.algoarena.competition.support.AbstractCompetitionDbTest;
import com.algoarena.entity.User;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.core.io.FileSystemResource;
import org.springframework.jdbc.datasource.init.ScriptUtils;

import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Connection;
import java.util.List;
import java.util.regex.Pattern;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Runs the REAL SQL script on a real PostgreSQL and proves the database itself enforces the rules the
 * application relies on - independent of any application code.
 */
class CompetitionSchemaScriptTest extends AbstractCompetitionDbTest {

    private static final String TS = "TIMESTAMPTZ '2026-06-01 12:00:00+00'";

    private static Path scriptsDir() {
        Path here = Path.of("").toAbsolutePath();
        return (Files.exists(here.resolve("db")) ? here : here.getParent()).resolve("db/competition");
    }

    private long competition(long hostId, int min, int max, int playerCount, String status) {
        return jdbc.queryForObject("INSERT INTO competitions (status, created_by, host_id, min_players, max_players, question_count, "
                + "duration_seconds, countdown_seconds, player_count, created_at, lobby_deadline_at) VALUES (?, ?, ?, ?, ?, 10, 1200, 10, ?, "
                + TS + ", " + TS + ") RETURNING id", Long.class, status, hostId, hostId, min, max, playerCount);
    }

    private long participant(long competitionId, long userId, boolean active) {
        return jdbc.queryForObject("INSERT INTO competition_participants (competition_id, user_id, status, active, joined_at) "
                + "VALUES (?, ?, 'JOINED', ?, " + TS + ") RETURNING id", Long.class, competitionId, userId, active);
    }

    private void question(long competitionId, int number) {
        jdbc.update("INSERT INTO competition_questions (competition_id, question_number, source_id, question_text, options, correct_index) "
                + "VALUES (?, ?, ?, 'q', '[\"a\",\"b\",\"c\",\"d\"]'::jsonb, 0)", competitionId, number, "src-" + number);
    }

    @Test
    void theScriptIsIdempotentAndCreatesExactlyTheFourTables() throws Exception {
        try (Connection c = jdbc.getDataSource().getConnection()) {
            ScriptUtils.executeSqlScript(c, new FileSystemResource(scriptsDir().resolve("001_create_competition_tables.sql")));
            ScriptUtils.executeSqlScript(c, new FileSystemResource(scriptsDir().resolve("001_create_competition_tables.sql")));
        }
        List<String> tables = jdbc.queryForList("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' "
                + "AND table_name LIKE 'competition%' ORDER BY table_name", String.class);
        assertEquals(List.of("competition_participants", "competition_questions", "competition_submissions", "competitions"), tables);
    }

    @Test
    void theScriptOnlyCreatesThingsAndNeverTouchesExistingData() throws Exception {
        String sql = Files.readString(scriptsDir().resolve("001_create_competition_tables.sql"));
        String withoutComments = sql.replaceAll("(?m)--.*$", "");
        for (String forbidden : List.of("DROP ", "DELETE ", "TRUNCATE", "ALTER ", "UPDATE ", "INSERT ", "GRANT", "REVOKE")) {
            assertFalse(withoutComments.toUpperCase().contains(forbidden), "script must be additive, found " + forbidden.trim());
        }
        // every CREATE is guarded so a re-run is harmless
        assertEquals(0, Pattern.compile("CREATE\\s+(UNIQUE\\s+)?(TABLE|INDEX)\\s+(?!IF NOT EXISTS)", Pattern.CASE_INSENSITIVE)
                .matcher(withoutComments).results().count());
        // the only existing table it refers to is users
        assertTrue(Pattern.compile("REFERENCES\\s+users\\s*\\(id\\)").matcher(withoutComments).find());
        assertEquals(List.of(), Pattern.compile("REFERENCES\\s+(\\w+)").matcher(withoutComments).results()
                .map(m -> m.group(1)).filter(t -> !List.of("users", "competitions", "competition_participants", "competition_questions").contains(t)).toList());
    }

    @Test
    void theRollbackScriptDropsOnlyTheFourCompetitionTables() throws Exception {
        String sql = Files.readString(scriptsDir().resolve("001_rollback_drop_competition_tables.sql")).replaceAll("(?m)--.*$", "");
        List<String> dropped = Pattern.compile("DROP TABLE IF EXISTS (\\w+)").matcher(sql).results().map(m -> m.group(1)).toList();
        assertEquals(List.of("competition_submissions", "competition_questions", "competition_participants", "competitions"), dropped);
        assertFalse(sql.toUpperCase().contains("CASCADE"), "no CASCADE: it must not be able to reach other tables");
    }

    // ------------------------------------------------------------------ the 25-player cap and basic sanity, in the database

    @Test
    void aCompetitionCanNeverBeConfiguredForMoreThan25Players() {
        User host = newUser("host");
        assertThrows(DataIntegrityViolationException.class, () -> competition(host.getId(), 2, 26, 0, "LOBBY"));
        assertThrows(DataIntegrityViolationException.class, () -> competition(host.getId(), 2, 100, 0, "LOBBY"));
        assertDoesNotThrow(() -> competition(host.getId(), 2, 25, 0, "LOBBY"));
    }

    @Test
    void thePlayerCountCanNeverExceedTheMaximumEvenIfTheApplicationWereWrong() {
        User host = newUser("host");
        long id = competition(host.getId(), 2, 25, 25, "LOBBY");

        assertThrows(DataIntegrityViolationException.class, () -> jdbc.update("UPDATE competitions SET player_count = 26 WHERE id = ?", id));
        assertThrows(DataIntegrityViolationException.class, () -> jdbc.update("UPDATE competitions SET player_count = -1 WHERE id = ?", id));
        assertThrows(DataIntegrityViolationException.class, () -> competition(host.getId(), 2, 10, 11, "LOBBY"));
    }

    @Test
    void invalidStatesAndInconsistentSettingsAreRejected() {
        User host = newUser("host");
        assertThrows(DataIntegrityViolationException.class, () -> competition(host.getId(), 2, 25, 0, "WHATEVER"));
        assertThrows(DataIntegrityViolationException.class, () -> competition(host.getId(), 1, 25, 0, "LOBBY"));   // min below 2
        assertThrows(DataIntegrityViolationException.class, () -> competition(host.getId(), 10, 5, 0, "LOBBY"));   // max below min
        long id = competition(host.getId(), 2, 25, 0, "LOBBY");
        assertThrows(DataIntegrityViolationException.class, () -> jdbc.update(
                "UPDATE competitions SET start_time = " + TS + ", end_time = " + TS + " WHERE id = ?", id)); // end must be after start
    }

    // ------------------------------------------------------------------ membership rules

    @Test
    void aUserCannotBeInTheSameCompetitionTwice() {
        User host = newUser("host");
        long c = competition(host.getId(), 2, 25, 1, "LOBBY");
        participant(c, host.getId(), true);

        assertThrows(DataIntegrityViolationException.class, () -> participant(c, host.getId(), true));
        assertThrows(DataIntegrityViolationException.class, () -> participant(c, host.getId(), false), "even as an inactive duplicate row");
    }

    @Test
    void aUserCanOnlyOccupyOneLiveCompetitionAtATime() {
        User host = newUser("host");
        User other = newUser("other");
        long c1 = competition(host.getId(), 2, 25, 1, "LOBBY");
        long c2 = competition(other.getId(), 2, 25, 1, "LOBBY");
        participant(c1, host.getId(), true);

        assertThrows(DataIntegrityViolationException.class, () -> participant(c2, host.getId(), true));
        // once the first membership is released (finished / left), the user is free again
        jdbc.update("UPDATE competition_participants SET active = FALSE WHERE competition_id = ?", c1);
        assertDoesNotThrow(() -> participant(c2, host.getId(), true));
        // inactive history rows are unlimited
        assertDoesNotThrow(() -> participant(competition(other.getId(), 2, 25, 0, "FINISHED"), host.getId(), false));
    }

    // ------------------------------------------------------------------ one official answer per question

    @Test
    void oneParticipantCanSubmitOnlyOneAnswerPerQuestion() {
        User host = newUser("host");
        long c = competition(host.getId(), 2, 25, 1, "RUNNING");
        long p = participant(c, host.getId(), true);
        question(c, 1);
        String insert = "INSERT INTO competition_submissions (competition_id, participant_id, question_number, selected_index, "
                + "is_correct, score_awarded, submitted_at) VALUES (?, ?, ?, 0, TRUE, 100, " + TS + ")";

        jdbc.update(insert, c, p, 1);
        assertThrows(DataIntegrityViolationException.class, () -> jdbc.update(insert, c, p, 1));
    }

    @Test
    void submissionsMustReferenceARealParticipantAndQuestionOfTheSameCompetition() {
        User a = newUser("a");
        User b = newUser("b");
        long c1 = competition(a.getId(), 2, 25, 1, "RUNNING");
        long c2 = competition(b.getId(), 2, 25, 1, "RUNNING");
        long pOfC1 = participant(c1, a.getId(), true);
        question(c1, 1);
        question(c2, 1);
        String insert = "INSERT INTO competition_submissions (competition_id, participant_id, question_number, selected_index, "
                + "is_correct, score_awarded, submitted_at) VALUES (?, ?, ?, 0, FALSE, 0, " + TS + ")";

        assertThrows(DataIntegrityViolationException.class, () -> jdbc.update(insert, c2, pOfC1, 1), "participant belongs to another competition");
        assertThrows(DataIntegrityViolationException.class, () -> jdbc.update(insert, c1, pOfC1, 7), "question does not exist");
        assertThrows(DataIntegrityViolationException.class, () -> jdbc.update(insert, c1, 99999, 1), "participant does not exist");
        assertDoesNotThrow(() -> jdbc.update(insert, c1, pOfC1, 1));
    }

    @Test
    void aScoreCanNeverBeNegativeAndCorrectCannotExceedAnswered() {
        User host = newUser("host");
        long c = competition(host.getId(), 2, 25, 1, "RUNNING");
        long p = participant(c, host.getId(), true);
        question(c, 1);

        assertThrows(DataIntegrityViolationException.class, () -> jdbc.update(
                "INSERT INTO competition_submissions (competition_id, participant_id, question_number, selected_index, is_correct, "
                        + "score_awarded, submitted_at) VALUES (?, ?, 1, 0, FALSE, -50, " + TS + ")", c, p));
        assertThrows(DataIntegrityViolationException.class, () -> jdbc.update(
                "UPDATE competition_participants SET answered_count = 1, correct_count = 2 WHERE id = ?", p));
    }

    @Test
    void questionNumbersAndSourcesAreUniquePerCompetition() {
        User host = newUser("host");
        long c = competition(host.getId(), 2, 25, 1, "STARTING");
        question(c, 1);

        assertThrows(DataIntegrityViolationException.class, () -> question(c, 1));
        assertThrows(DataIntegrityViolationException.class, () -> jdbc.update("INSERT INTO competition_questions (competition_id, question_number, "
                + "source_id, question_text, options, correct_index) VALUES (?, 2, 'src-1', 'q', '[]'::jsonb, 0)", c), "same source question twice");
    }
}
