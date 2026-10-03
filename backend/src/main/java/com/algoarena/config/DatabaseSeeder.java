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
    private final MysteryCaseRepository mysteryCaseRepository;
    private final DailyChallengeRepository dailyChallengeRepository;
    private final com.algoarena.service.DailyChallengeService dailyChallengeService;
    private final org.springframework.jdbc.core.JdbcTemplate jdbcTemplate;

    public DatabaseSeeder(
            GameRepository gameRepository,
            PuzzleRepository puzzleRepository,
            AchievementRepository achievementRepository,
            MysteryCaseRepository mysteryCaseRepository,
            DailyChallengeRepository dailyChallengeRepository,
            com.algoarena.service.DailyChallengeService dailyChallengeService,
            org.springframework.jdbc.core.JdbcTemplate jdbcTemplate
    ) {
        this.gameRepository = gameRepository;
        this.puzzleRepository = puzzleRepository;
        this.achievementRepository = achievementRepository;
        this.mysteryCaseRepository = mysteryCaseRepository;
        this.dailyChallengeRepository = dailyChallengeRepository;
        this.dailyChallengeService = dailyChallengeService;
        this.jdbcTemplate = jdbcTemplate;
    }

    @Override
    public void run(String... args) throws Exception {
        initQuestionHistoryTable();
        seedAchievements();
        seedGamesAndPuzzles();
        seedMysteryCases();
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
                .achievementKey("master-detective")
                .title("Master Detective")
                .description("Solve 10 mystery cases.")
                .emoji("🕵️")
                .requirementType("mysteries_solved")
                .requirementValue(10)
                .xpReward(500)
                .rarity("EPIC")
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
        log.info("Synchronizing games and puzzles for the 6-game lineup...");

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
                .slug("brain-teaser-battle")
                .title("Brain Teaser Battle")
                .description("Challenge your mind with riddles, aptitude questions, mental math, and quick-thinking problems.")
                .category("Brain Training")
                .icon("⚡")
                .difficulty("MEDIUM")
                .xpRewardEasy(15).xpRewardMedium(30).xpRewardHard(55)
                .isUnlocked(true).isNew(true).isFeatured(true)
                .totalPlayers(21400).completionRate(69)
                .estimatedTime("2-4 min")
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
                .slug("memory-challenge")
                .title("Memory Challenge")
                .description("Observe the scene, then recall every detail. Train your observation and memory skills.")
                .category("Brain Training")
                .icon("🧠")
                .difficulty("EASY")
                .xpRewardEasy(15).xpRewardMedium(25).xpRewardHard(50)
                .isUnlocked(true).isNew(false).isFeatured(false)
                .totalPlayers(18900).completionRate(80)
                .estimatedTime("2-4 min")
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

        // Clean up obsolete games from database safely
        List<String> obsoleteSlugs = List.of(
            "reaction-rush",
            "grid-puzzle",
            "speed-match",
            "who-is-lying",
            "pattern-detective",
            "spot-the-fallacy",
            "solve-crime"
        );
        for (String oldSlug : obsoleteSlugs) {
            gameRepository.findBySlug(oldSlug).ifPresent(oldGame -> {
                try {
                    gameRepository.delete(oldGame);
                } catch (Exception e) {
                    try {
                        oldGame.setIsUnlocked(false);
                        gameRepository.save(oldGame);
                    } catch (Exception ex) {
                        log.debug("Could not deactivate obsolete game {}", oldSlug);
                    }
                }
            });
        }

        log.info("Games synchronization complete.");
    }

    private void seedMysteryCases() {
        if (mysteryCaseRepository.count() > 0) {
            log.info("Mystery cases already seeded.");
            return;
        }

        log.info("Seeding mystery cases...");
        MysteryCase mCase = MysteryCase.builder()
                .title("The Missing Diamond")
                .subtitle("Case #001 — Mumbai Museum Heist")
                .difficulty("MEDIUM")
                .xpReward(150)
                .isUnlocked(true)
                .isNew(true)
                .coverEmoji("💎")
                .synopsis("The Koh-i-Light diamond vanished from the Mumbai Heritage Museum at exactly 8:00 PM on Friday. Security cameras captured a 2-minute blind spot. Three people had access.")
                .crimeDescription("On the evening of Friday, October 13th, the priceless Koh-i-Light diamond — valued at ₹12 crore — disappeared from its display case in Gallery 4 of the Mumbai Heritage Museum. Security cameras experienced a mysterious 2-minute outage from 7:58 PM to 8:00 PM. The thief exploited this window. Three individuals had key-card access to Gallery 4 after closing hours.")
                .suspects("[" +
                        "{\"id\": \"rahul\", \"name\": \"Rahul Sharma\", \"role\": \"Museum Security Guard\", \"avatar\": \"👮\", \"motive\": \"Recently fired, due to be replaced the following Monday\", \"statement\": \"I was doing my rounds on Floor 2 at 8 PM. I never went near Gallery 4 that night.\", \"alibi\": \"Claims to have been on Floor 2\", \"suspicious\": [\"Had key-card access\", \"Being replaced the following Monday\", \"Badge scanned on Floor 1 — not Floor 2 — at 7:55 PM\"]}," +
                        "{\"id\": \"aman\", \"name\": \"Aman Verma\", \"role\": \"Junior Curator\", \"avatar\": \"🧑‍🎨\", \"motive\": \"Massive gambling debts discovered by police\", \"statement\": \"I saw Rahul near Gallery 4 around 8 PM. I was in my office all evening working on a report.\", \"alibi\": \"Claims to have been in his office\", \"suspicious\": [\"His computer shows no activity between 7:45–8:15 PM\", \"Gambling debts of ₹8 lakh\", \"CCTV shows him entering the museum parking lot at 8:30 PM, not exiting\"]}," +
                        "{\"id\": \"priya\", \"name\": \"Priya Nair\", \"role\": \"Head of Security Systems\", \"avatar\": \"👩‍💻\", \"motive\": \"None discovered\", \"statement\": \"I was in the control room. The camera outage was a system glitch. I was talking with Aman on the phone at 8 PM.\", \"alibi\": \"Claims to be in control room; says she called Aman\", \"suspicious\": [\"Phone records show her call to Aman lasted only 30 seconds at 7:58 PM — before the theft\", \"She had the ability to manually trigger camera outages\"]}" +
                        "]")
                .evidence("[" +
                        "{\"id\": \"e1\", \"type\": \"CCTV\", \"title\": \"Security Badge Log\", \"emoji\": \"🔒\", \"content\": \"Badge records show: Rahul's badge scanned on Floor 1 at 7:55 PM. Aman's badge scanned at Gallery 4 entrance at 7:57 PM. Priya's badge scanned at Control Room at 7:50 PM.\", \"isKey\": true}," +
                        "{\"id\": \"e2\", \"type\": \"Digital\", \"title\": \"Computer Activity Log\", \"emoji\": \"💻\", \"content\": \"Aman's office computer: Last activity at 7:44 PM. Resume at 8:16 PM. A 32-minute gap with no activity, contradicting his alibi.\", \"isKey\": true}," +
                        "{\"id\": \"e3\", \"type\": \"Phone\", \"title\": \"Phone Records\", \"emoji\": \"📱\", \"content\": \"Priya called Aman at 7:58 PM — call duration: 28 seconds. The call ended before the camera outage began. Her alibi of 'talking to Aman at 8 PM' is incorrect.\", \"isKey\": false}," +
                        "{\"id\": \"e4\", \"type\": \"Physical\", \"title\": \"Parking Lot CCTV\", \"emoji\": \"🚗\", \"content\": \"Aman's car was captured entering the museum parking lot at 7:50 PM, not exiting until 8:47 PM. His car never left during the heist window.\", \"isKey\": false}," +
                        "{\"id\": \"e5\", \"type\": \"Financial\", \"title\": \"Bank Records\", \"emoji\": \"💰\", \"content\": \"Aman has ₹8.3 lakh in documented gambling debts. A payment of ₹2 lakh was made to a creditor 3 days before the heist.\", \"isKey\": false}," +
                        "{\"id\": \"e6\", \"type\": \"Physical\", \"title\": \"Fingerprints on Case\", \"emoji\": \"👆\", \"content\": \"Partial fingerprints found on the display case glass. Analysis matches Aman Verma. However, as curator, he had legitimate reasons to touch the case.\", \"isKey\": true}" +
                        "]")
                .timeline("[" +
                        "{\"time\": \"7:44 PM\", \"event\": \"Last computer activity on Aman's workstation\"}," +
                        "{\"time\": \"7:50 PM\", \"event\": \"Priya's badge scanned at Control Room\"}," +
                        "{\"time\": \"7:50 PM\", \"event\": \"Aman's car enters museum parking lot\"}," +
                        "{\"time\": \"7:55 PM\", \"event\": \"Rahul's badge scanned on Floor 1 (NOT Floor 2 as claimed)\"}," +
                        "{\"time\": \"7:57 PM\", \"event\": \"Aman's badge scanned at Gallery 4 entrance\"}," +
                        "{\"time\": \"7:58 PM\", \"event\": \"Priya calls Aman — call lasts 28 seconds\"}," +
                        "{\"time\": \"7:58 PM\", \"event\": \"Camera outage begins in Gallery 4\"}," +
                        "{\"time\": \"8:00 PM\", \"event\": \"Diamond reported missing. Cameras resume.\"}," +
                        "{\"time\": \"8:16 PM\", \"event\": \"Aman's computer activity resumes\"}," +
                        "{\"time\": \"8:47 PM\", \"event\": \"Aman's car exits parking lot\"}" +
                        "]")
                .correctAnswer("{\"culprit\": \"aman\", \"motive\": \"gambling-debts\", \"keyEvidence\": [\"e1\", \"e2\", \"e6\"]}")
                .solution("Aman Verma stole the diamond. His badge was scanned at Gallery 4 at 7:57 PM — 1 minute before the camera outage. His computer shows no activity during the theft window, debunking his alibi. His fingerprints were on the case. With ₹8.3 lakh in debts and desperate for money, he used his curator access to steal the diamond during the planned camera blind spot.")
                .culpritChoices("[" +
                        "{\"id\": \"rahul\", \"label\": \"Rahul Sharma (Security Guard)\"}," +
                        "{\"id\": \"aman\", \"label\": \"Aman Verma (Junior Curator)\"}," +
                        "{\"id\": \"priya\", \"label\": \"Priya Nair (Head of Security Systems)\"}" +
                        "]")
                .motiveChoices("[" +
                        "{\"id\": \"gambling-debts\", \"label\": \"Gambling debts and financial desperation\"}," +
                        "{\"id\": \"personal-grudge\", \"label\": \"Personal grudge against the museum director\"}," +
                        "{\"id\": \"hired\", \"label\": \"Hired by an outside criminal organization\"}," +
                        "{\"id\": \"revenge\", \"label\": \"Revenge for being passed over for promotion\"}" +
                        "]")
                .build();

        mysteryCaseRepository.save(mCase);
        log.info("Seeding mystery cases complete.");
    }

    private void seedDailyChallenge() {
        LocalDate today = LocalDate.now(java.time.ZoneId.of("Asia/Kolkata"));
        dailyChallengeService.ensureChallengeForDate(today);
        log.info("Daily challenge initialized for date {}", today);
    }
}
