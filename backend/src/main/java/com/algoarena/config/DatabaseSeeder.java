package com.algoarena.config;

import com.algoarena.entity.*;
import com.algoarena.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.util.List;

@Slf4j
@Component
public class DatabaseSeeder implements CommandLineRunner {

    private final GameRepository gameRepository;
    private final PuzzleRepository puzzleRepository;
    private final AchievementRepository achievementRepository;
    private final DailyChallengeRepository dailyChallengeRepository;
    private final com.algoarena.service.DailyChallengeService dailyChallengeService;
    private final org.springframework.jdbc.core.JdbcTemplate jdbcTemplate;

    public DatabaseSeeder(
            GameRepository gameRepository,
            PuzzleRepository puzzleRepository,
            AchievementRepository achievementRepository,
            DailyChallengeRepository dailyChallengeRepository,
            com.algoarena.service.DailyChallengeService dailyChallengeService,
            org.springframework.jdbc.core.JdbcTemplate jdbcTemplate
    ) {
        this.gameRepository = gameRepository;
        this.puzzleRepository = puzzleRepository;
        this.achievementRepository = achievementRepository;
        this.dailyChallengeRepository = dailyChallengeRepository;
        this.dailyChallengeService = dailyChallengeService;
        this.jdbcTemplate = jdbcTemplate;
    }

    @Override
    public void run(String... args) throws Exception {
        initQuestionHistoryTable();
        seedAchievements();
        seedGamesAndPuzzles();
        seedDailyChallenge();
    }

    private void initQuestionHistoryTable() {
        try {
            jdbcTemplate.execute(
                "CREATE TABLE IF NOT EXISTS user_question_history (" +
                "  id BIGSERIAL PRIMARY KEY, " +
                "  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE, " +
                "  game_slug VARCHAR(60) NOT NULL, " +
                "  difficulty VARCHAR(20) NOT NULL, " +
                "  question_id VARCHAR(100) NOT NULL, " +
                "  played_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, " +
                "  CONSTRAINT uq_user_game_diff_q UNIQUE (user_id, game_slug, difficulty, question_id)" +
                ");"
            );
            jdbcTemplate.execute(
                "CREATE INDEX IF NOT EXISTS idx_uqh_user_game_diff ON user_question_history(user_id, game_slug, difficulty);"
            );
            log.info("user_question_history table verified.");
        } catch (Exception e) {
            log.warn("Could not verify/create user_question_history table: {}", e.getMessage());
        }
    }

    private void seedAchievements() {
        if (achievementRepository.count() > 0) {
            log.info("Achievements already seeded.");
            return;
        }

        log.info("Seeding achievements...");
        List<Achievement> achievements = List.of(
            Achievement.builder()
                .achievementKey("first-steps")
                .title("First Steps")
                .description("Complete your first game.")
                .emoji("🌱")
                .requirementType("games_completed")
                .requirementValue(1)
                .xpReward(25)
                .rarity("COMMON")
                .build(),
            Achievement.builder()
                .achievementKey("logic-master")
                .title("Logic Master")
                .description("Solve 50 logic puzzles.")
                .emoji("🧠")
                .requirementType("games_completed")
                .requirementValue(50)
                .xpReward(200)
                .rarity("RARE")
                .build(),
            Achievement.builder()
                .achievementKey("speed-thinker")
                .title("Speed Thinker")
                .description("Solve 10 games without using hints.")
                .emoji("⚡")
                .requirementType("no_hint_games")
                .requirementValue(10)
                .xpReward(150)
                .rarity("UNCOMMON")
                .build(),
            Achievement.builder()
                .achievementKey("streak-7")
                .title("Week Warrior")
                .description("Play for 7 consecutive days.")
                .emoji("🔥")
                .requirementType("streak")
                .requirementValue(7)
                .xpReward(100)
                .rarity("UNCOMMON")
                .build(),
            Achievement.builder()
                .achievementKey("streak-30")
                .title("Iron Mind")
                .description("Maintain a 30-day streak.")
                .emoji("💪")
                .requirementType("streak")
                .requirementValue(30)
                .xpReward(500)
                .rarity("EPIC")
                .build(),
            Achievement.builder()
                .achievementKey("mastermind")
                .title("Mastermind")
                .description("Reach Level 25 and become a true Mastermind.")
                .emoji("👑")
                .requirementType("level")
                .requirementValue(25)
                .xpReward(1000)
                .rarity("LEGENDARY")
                .build(),
            Achievement.builder()
                .achievementKey("penny-collector")
                .title("Treasure Hunter")
                .description("Collect 1000 coins.")
                .emoji("🪙")
                .requirementType("coins")
                .requirementValue(1000)
                .xpReward(150)
                .rarity("UNCOMMON")
                .build()
        );

        achievementRepository.saveAll(achievements);
        log.info("Seeding achievements complete.");
    }

    private void seedGamesAndPuzzles() {
        log.info("Synchronizing games and puzzles for the 4-game lineup...");

        // Define the active games lineup
        List<Game> activeGames = List.of(
            Game.builder()
                .slug("dsa-master-quiz")
                .title("DSA Master Quiz")
                .description("Test your coding knowledge, DSA concepts, code output skills, and complexity understanding.")
                .category("Programming / DSA")
                .icon("🧠")
                .difficulty("HARD")
                .xpRewardEasy(15).xpRewardMedium(30).xpRewardHard(60)
                .isUnlocked(true).isNew(true).isFeatured(true)
                .totalPlayers(24500).completionRate(64)
                .estimatedTime("3-5 min")
                .build(),
            Game.builder()
                .slug("logic-puzzle")
                .title("Logic Puzzle")
                .description("Solve patterns, sequences, deduction problems, and logical puzzles.")
                .category("Reasoning")
                .icon("🧩")
                .difficulty("MEDIUM")
                .xpRewardEasy(15).xpRewardMedium(25).xpRewardHard(50)
                .isUnlocked(true).isNew(true).isFeatured(true)
                .totalPlayers(19800).completionRate(72)
                .estimatedTime("3-4 min")
                .build(),
            Game.builder()
                .slug("number-detective")
                .title("Number Detective")
                .description("Crack the code hidden in number sequences. Find the pattern and discover the missing number.")
                .category("Reasoning")
                .icon("🔢")
                .difficulty("MEDIUM")
                .xpRewardEasy(10).xpRewardMedium(25).xpRewardHard(50)
                .isUnlocked(true).isNew(false).isFeatured(false)
                .totalPlayers(12450).completionRate(68)
                .estimatedTime("3-5 min")
                .build(),
            Game.builder()
                .slug("code-breaker")
                .title("Code Breaker")
                .description("Use logical clues to deduce the secret code. Test your deductive reasoning and elimination skills.")
                .category("Reasoning")
                .icon("🔐")
                .difficulty("MEDIUM")
                .xpRewardEasy(15).xpRewardMedium(30).xpRewardHard(60)
                .isUnlocked(true).isNew(false).isFeatured(false)
                .totalPlayers(9420).completionRate(62)
                .estimatedTime("3-5 min")
                .build()
        );

        for (Game g : activeGames) {
            Game existing = gameRepository.findBySlug(g.getSlug()).orElse(null);
            if (existing == null) {
                gameRepository.save(g);
            } else {
                existing.setTitle(g.getTitle());
                existing.setDescription(g.getDescription());
                existing.setCategory(g.getCategory());
                existing.setIcon(g.getIcon());
                existing.setDifficulty(g.getDifficulty());
                existing.setXpRewardEasy(g.getXpRewardEasy());
                existing.setXpRewardMedium(g.getXpRewardMedium());
                existing.setXpRewardHard(g.getXpRewardHard());
                existing.setIsUnlocked(g.getIsUnlocked());
                existing.setIsNew(g.getIsNew());
                existing.setIsFeatured(g.getIsFeatured());
                existing.setTotalPlayers(g.getTotalPlayers());
                existing.setCompletionRate(g.getCompletionRate());
                existing.setEstimatedTime(g.getEstimatedTime());
                gameRepository.save(existing);
            }
        }

        log.info("Games synchronization complete.");
    }

    private void seedDailyChallenge() {
        LocalDate today = LocalDate.now(java.time.ZoneId.of("Asia/Kolkata"));
        dailyChallengeService.ensureChallengeForDate(today);
        log.info("Daily challenge initialized for date {}", today);
    }
}
