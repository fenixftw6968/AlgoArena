package com.algoarena.service;

import com.algoarena.config.DatabaseSeeder;
import com.algoarena.dto.AttemptRequest;
import com.algoarena.dto.GameDto;
import com.algoarena.dto.QuestionHistoryDto;
import com.algoarena.entity.Achievement;
import com.algoarena.entity.Game;
import com.algoarena.entity.User;
import com.algoarena.exception.BadRequestException;
import com.algoarena.exception.ResourceNotFoundException;
import com.algoarena.repository.AchievementRepository;
import com.algoarena.repository.DailyChallengeRepository;
import com.algoarena.repository.FriendshipRepository;
import com.algoarena.repository.GameAttemptRepository;
import com.algoarena.repository.GameRepository;
import com.algoarena.repository.MatchRepository;
import com.algoarena.repository.PuzzleRepository;
import com.algoarena.repository.UserAchievementRepository;
import com.algoarena.repository.UserQuestionHistoryRepository;
import com.algoarena.repository.UserRepository;
import com.algoarena.util.SupportedGames;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.transaction.support.TransactionTemplate;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;
import java.util.stream.Stream;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyIterable;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

/**
 * Game cleanup - exactly four games exist: DSA Master Quiz, Logic Puzzle, Number Detective, Code Breaker.
 * Retired games must be unreachable through every API even if stale rows are still in the database, and
 * the application must never delete anything from the database to get there.
 */
class GameCatalogCleanupTest {

    private static final List<String> APPROVED = List.of("dsa-master-quiz", "logic-puzzle", "number-detective", "code-breaker");

    /** Slugs of games that used to exist (or were planned) and must never work again. */
    private static final List<String> RETIRED = List.of(
            "memory-challenge", "brain-teaser-battle", "mystery", "mystery-case", "murder-case", "mystery-cases",
            "reaction-rush", "grid-puzzle", "speed-match", "who-is-lying", "pattern-detective", "spot-the-fallacy",
            "solve-crime", "solve-the-crime", "daily", "", "  ", "dsa-master-quiz/../memory-challenge");

    // ================================================================== the allowlist itself

    @Test
    void exactlyTheFourApprovedGamesAreSupportedInDisplayOrder() {
        assertEquals(APPROVED, SupportedGames.SLUGS);
    }

    @Test
    void approvedSlugsAreAcceptedCaseInsensitivelyAndRetiredOnesNever() {
        for (String slug : APPROVED) {
            assertTrue(SupportedGames.isSupported(slug), slug);
            assertTrue(SupportedGames.isSupported(" " + slug.toUpperCase() + " "), slug);
            assertEquals(slug, SupportedGames.require(slug.toUpperCase()));
        }
        for (String slug : RETIRED) {
            assertFalse(SupportedGames.isSupported(slug), "'" + slug + "'");
            assertThrows(BadRequestException.class, () -> SupportedGames.require(slug), slug);
        }
        assertFalse(SupportedGames.isSupported(null));
    }

    // ================================================================== catalog / puzzles / attempts (GameService)

    private GameService gameService(GameRepository games, PuzzleRepository puzzles, UserRepository users) {
        return new GameService(games, puzzles, mock(GameAttemptRepository.class), users, mock(UserService.class), new ObjectMapper());
    }

    private static Game game(String slug) {
        return Game.builder().id((long) slug.hashCode()).slug(slug).title(slug).description("d")
                .category("c").icon("i").difficulty("MEDIUM").build();
    }

    @Test
    void catalogListsOnlyApprovedGamesEvenIfStaleRowsStillExistInTheDatabase() {
        GameRepository games = mock(GameRepository.class);
        List<Game> rows = Stream.concat(APPROVED.stream(), Stream.of("memory-challenge", "brain-teaser-battle", "solve-crime"))
                .map(GameCatalogCleanupTest::game).toList();
        when(games.findAll()).thenReturn(rows);

        List<String> listed = gameService(games, mock(PuzzleRepository.class), mock(UserRepository.class))
                .getAllGames().stream().map(GameDto::getSlug).collect(Collectors.toList());

        assertEquals(Set.copyOf(APPROVED), Set.copyOf(listed));
        assertEquals(4, listed.size());
    }

    @Test
    void retiredGamesAreNotFoundByTheCatalogPuzzlesOrAttemptsEvenWithAStaleRow() {
        GameRepository games = mock(GameRepository.class);
        PuzzleRepository puzzles = mock(PuzzleRepository.class);
        UserRepository users = mock(UserRepository.class);
        UserService userService = mock(UserService.class);
        for (String slug : RETIRED) {
            when(games.findBySlug(slug)).thenReturn(Optional.of(game(slug)));
        }
        when(users.findById(anyLong())).thenReturn(Optional.of(User.builder().id(1L).noHintGames(0).build()));
        GameService service = new GameService(games, puzzles, mock(GameAttemptRepository.class), users, userService, new ObjectMapper());

        for (String slug : List.of("memory-challenge", "brain-teaser-battle", "mystery", "murder-case", "grid-puzzle")) {
            assertThrows(ResourceNotFoundException.class, () -> service.getGameBySlug(slug), slug);
            assertThrows(ResourceNotFoundException.class, () -> service.getPuzzlesByGame(slug, null), slug);
            assertThrows(ResourceNotFoundException.class, () -> service.submitAttempt(1L, slug,
                    AttemptRequest.builder().userAnswer("x").hintUsed(false).build()), slug);
        }
        verifyNoInteractions(puzzles);
        verify(userService, never()).updateProgression(any(), anyInt(), anyInt());
    }

    @Test
    void approvedGamesStillResolveInTheCatalog() {
        GameRepository games = mock(GameRepository.class);
        for (String slug : APPROVED) {
            when(games.findBySlug(slug)).thenReturn(Optional.of(game(slug)));
        }
        GameService service = gameService(games, mock(PuzzleRepository.class), mock(UserRepository.class));

        for (String slug : APPROVED) {
            assertEquals(slug, service.getGameBySlug(slug).getSlug());
        }
    }

    // ================================================================== matches

    @Test
    void matchmakingAndInvitesRejectEveryRetiredSlug() {
        MatchService match = new MatchService(mock(MatchRepository.class), mock(UserRepository.class), mock(FriendshipRepository.class),
                new EloRatingService(), mock(GameService.class), new ObjectMapper(), mock(SimpMessagingTemplate.class),
                mock(TransactionTemplate.class));

        for (String slug : RETIRED) {
            assertThrows(BadRequestException.class, () -> match.queueForMatch(1L, slug, "EASY"), "queue '" + slug + "'");
            assertThrows(BadRequestException.class, () -> match.createFriendMatch(1L, 2L, slug, "EASY"), "invite '" + slug + "'");
        }
    }

    // ================================================================== question history

    @Test
    void questionHistoryRefusesRetiredGames() {
        QuestionHistoryService history = new QuestionHistoryService(mock(UserQuestionHistoryRepository.class),
                mock(UserRepository.class), mock(JdbcTemplate.class));

        for (String slug : List.of("memory-challenge", "brain-teaser-battle", "mystery")) {
            assertThrows(BadRequestException.class, () -> history.selectAndReserveQuestions(1L,
                    QuestionHistoryDto.SelectionRequest.builder().gameSlug(slug).build()), slug);
            assertThrows(BadRequestException.class, () -> history.recordUsedQuestions(1L,
                    QuestionHistoryDto.RecordRequest.builder().gameSlug(slug).build()), slug);
            assertThrows(BadRequestException.class, () -> history.getQuestionHistory(1L, slug, "ALL"), slug);
            assertThrows(BadRequestException.class, () -> history.resetHistory(1L, slug, "ALL"), slug);
        }
    }

    // ================================================================== the seeder never deletes anything

    @Test
    void seederOnlyEverWritesTheFourApprovedGamesAndNeverDeletesOrAltersTheSchemaDestructively() {
        GameRepository games = mock(GameRepository.class);
        AchievementRepository achievements = mock(AchievementRepository.class);
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(games.findBySlug(anyString())).thenReturn(Optional.empty());
        when(achievements.count()).thenReturn(0L);
        DatabaseSeeder seeder = new DatabaseSeeder(games, mock(PuzzleRepository.class), achievements,
                mock(DailyChallengeRepository.class), mock(DailyChallengeService.class), jdbc);

        assertDoesNotThrow(() -> seeder.run());

        ArgumentCaptor<Game> saved = ArgumentCaptor.forClass(Game.class);
        verify(games, times(4)).save(saved.capture());
        assertEquals(Set.copyOf(APPROVED), saved.getAllValues().stream().map(Game::getSlug).collect(Collectors.toSet()));

        // no deletion of any kind, and retired games are not even looked up (so their stale rows are untouched)
        verify(games, never()).delete(any());
        verify(games, never()).deleteAll();
        verify(games, never()).deleteAll(anyIterable());
        verify(games, never()).deleteById(any());
        verify(games, never()).deleteAllInBatch();
        for (String retired : List.of("memory-challenge", "brain-teaser-battle", "reaction-rush", "grid-puzzle", "speed-match",
                "who-is-lying", "pattern-detective", "spot-the-fallacy", "solve-crime")) {
            verify(games, never()).findBySlug(retired);
        }

        // the only SQL the seeder issues is idempotent creation of its own table/index
        ArgumentCaptor<String> sql = ArgumentCaptor.forClass(String.class);
        verify(jdbc, atLeast(0)).execute(sql.capture());
        for (String statement : sql.getAllValues()) {
            String upper = statement.toUpperCase().trim();
            assertTrue(upper.startsWith("CREATE TABLE IF NOT EXISTS") || upper.startsWith("CREATE INDEX IF NOT EXISTS"), statement);
            assertFalse(upper.contains("DROP ") || upper.contains("DELETE FROM") || upper.contains("TRUNCATE") || upper.contains("ALTER TABLE"), statement);
        }
    }

    @Test
    void seededAchievementsContainNothingForRetiredFeatures() throws Exception {
        GameRepository games = mock(GameRepository.class);
        AchievementRepository achievements = mock(AchievementRepository.class);
        when(games.findBySlug(anyString())).thenReturn(Optional.empty());
        when(achievements.count()).thenReturn(0L);
        new DatabaseSeeder(games, mock(PuzzleRepository.class), achievements, mock(DailyChallengeRepository.class),
                mock(DailyChallengeService.class), mock(JdbcTemplate.class)).run();

        @SuppressWarnings("unchecked")
        ArgumentCaptor<Iterable<Achievement>> seeded = ArgumentCaptor.forClass(Iterable.class);
        verify(achievements).saveAll(seeded.capture());
        for (Achievement a : seeded.getValue()) {
            assertTrue(Set.of("games_completed", "no_hint_games", "streak", "level", "coins").contains(a.getRequirementType()), a.getAchievementKey());
            assertFalse(a.getDescription().toLowerCase().contains("mystery"), a.getAchievementKey());
        }
    }

    // ================================================================== legacy achievements already in the DB stay inert

    @Test
    void legacyAchievementRowsAreHiddenAndNeverUnlocked() {
        AchievementRepository achievements = mock(AchievementRepository.class);
        UserAchievementRepository userAchievements = mock(UserAchievementRepository.class);
        Achievement current = Achievement.builder().id(1L).achievementKey("first-steps").title("t").description("d").emoji("e")
                .requirementType("games_completed").requirementValue(1).build();
        Achievement legacy = Achievement.builder().id(2L).achievementKey("legacy").title("t").description("d").emoji("e")
                .requirementType("mysteries_solved").requirementValue(0).build();
        when(achievements.findAll()).thenReturn(List.of(current, legacy));
        when(userAchievements.findByUserId(anyLong())).thenReturn(List.of());
        AchievementService service = new AchievementService(achievements, userAchievements, mock(UserRepository.class));

        assertEquals(List.of(current), service.getAllAchievements(), "retired-feature achievements are not shown");

        User user = User.builder().id(1L).gamesCompleted(0).noHintGames(0).currentStreak(0).longestStreak(0).level(1).coins(0).xp(0).build();
        assertDoesNotThrow(() -> service.checkAndUnlockAchievements(user));
        verify(userAchievements, never()).save(any());
    }

    // ================================================================== question banks on disk

    @Test
    void onlyTheFourApprovedQuestionBanksExistOnTheClasspath() throws Exception {
        Path dir = Path.of(getClass().getClassLoader().getResource("questions").toURI());
        try (Stream<Path> files = Files.list(dir)) {
            Set<String> banks = files.map(p -> p.getFileName().toString().replace(".json", "")).collect(Collectors.toSet());
            assertEquals(Set.copyOf(APPROVED), banks);
        }
    }
}
