package com.algoarena.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.algoarena.entity.DailyChallenge;
import com.algoarena.entity.User;
import com.algoarena.entity.UserDailyChallenge;
import com.algoarena.exception.BadRequestException;
import com.algoarena.exception.ResourceNotFoundException;
import com.algoarena.repository.DailyChallengeRepository;
import com.algoarena.repository.UserDailyChallengeRepository;
import com.algoarena.repository.UserRepository;
import jakarta.annotation.PostConstruct;
import lombok.Builder;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.ZoneId;
import java.util.*;

@Slf4j
@Service
@RequiredArgsConstructor
public class DailyChallengeService {

    private final DailyChallengeRepository dailyChallengeRepository;
    private final UserDailyChallengeRepository userDailyChallengeRepository;
    private final UserRepository userRepository;
    private final UserService userService;
    private final ObjectMapper objectMapper;

    private static final ZoneId IST_ZONE = ZoneId.of("Asia/Kolkata");

    @Data
    @Builder
    private static class ChallengeTemplate {
        private String title;
        private String description;
        private String type;
        private String difficulty;
        private Integer xpReward;
        private Integer coinReward;
        private String puzzleJson;
    }

    private List<ChallengeTemplate> dsaTemplates = new ArrayList<>();

    private static final List<ChallengeTemplate> FALLBACK_DSA_CHALLENGES = List.of(
        ChallengeTemplate.builder()
            .title("Binary Search Tree Asymptotics")
            .description("Test your algorithmic asymptotic reasoning on binary search tree operations.")
            .type("dsa-master-quiz")
            .difficulty("HARD")
            .xpReward(120)
            .coinReward(60)
            .puzzleJson("{\"question\": \"What is the worst-case search time complexity in a completely unbalanced binary search tree of N nodes?\", \"options\": [\"O(N)\", \"O(log N)\", \"O(N log N)\", \"O(1)\"], \"answer\": \"O(N)\", \"correctAnswer\": \"O(N)\", \"explanation\": \"When keys are inserted in sorted order, an unbalanced BST degenerates into a linear linked list of height N, requiring O(N) traversal time.\", \"hint\": \"Think about a degenerate tree that resembles a singly linked list.\"}")
            .build(),
        ChallengeTemplate.builder()
            .title("Dynamic Programming Knapsack")
            .description("Analyze the state-space bound for classic 0/1 knapsack dynamic programming.")
            .type("dsa-master-quiz")
            .difficulty("HARD")
            .xpReward(130)
            .coinReward(65)
            .puzzleJson("{\"question\": \"What is the time complexity of the dynamic programming solution for 0/1 Knapsack with N items and maximum weight W?\", \"options\": [\"O(N * W)\", \"O(2^N)\", \"O(N log W)\", \"O(W^2)\"], \"answer\": \"O(N * W)\", \"correctAnswer\": \"O(N * W)\", \"explanation\": \"The 2D DP grid dp[N+1][W+1] evaluates each state in O(1) time, yielding pseudo-polynomial O(N * W) total runtime.\", \"hint\": \"The DP table has dimensions proportional to the number of items and the capacity.\"}")
            .build(),
        ChallengeTemplate.builder()
            .title("Array Index Access")
            .description("Test your algorithmic reasoning on direct contiguous memory access.")
            .type("dsa-master-quiz")
            .difficulty("EASY")
            .xpReward(80)
            .coinReward(40)
            .puzzleJson("{\"question\": \"What is the time complexity to access an element by index in a C++ array?\", \"options\": [\"O(1)\", \"O(n)\", \"O(log n)\", \"O(n log n)\"], \"answer\": \"O(1)\", \"correctAnswer\": \"O(1)\", \"explanation\": \"Arrays occupy contiguous memory blocks, allowing direct arithmetic offset calculations: Base_Address + Index * Size.\", \"hint\": \"Direct offset calculation requires no search.\"}")
            .build(),
        ChallengeTemplate.builder()
            .title("Dynamic Array Amortized Time")
            .description("Evaluate geometric growth amortized bounds in standard vectors.")
            .type("dsa-master-quiz")
            .difficulty("EASY")
            .xpReward(80)
            .coinReward(40)
            .puzzleJson("{\"question\": \"What is the amortized time complexity of inserting an element at the end of a std::vector in C++?\", \"options\": [\"O(1)\", \"O(n)\", \"O(log n)\", \"O(n^2)\"], \"answer\": \"O(1)\", \"correctAnswer\": \"O(1)\", \"explanation\": \"std::vector uses geometric array growth (doubling capacity), resulting in O(1) amortized insertion time.\", \"hint\": \"Geometric doubling makes reallocations rare.\"}")
            .build()
    );

    @PostConstruct
    public void initDsaChallenges() {
        try (var is = getClass().getClassLoader().getResourceAsStream("questions/dsa-master-quiz.json")) {
            if (is != null) {
                List<Map<String, Object>> questions = objectMapper.readValue(is, new TypeReference<List<Map<String, Object>>>() {});
                if (questions != null && !questions.isEmpty()) {
                    List<ChallengeTemplate> loaded = new ArrayList<>();
                    for (Map<String, Object> q : questions) {
                        String title = Objects.toString(q.get("title"), "DSA Challenge");
                        String category = Objects.toString(q.get("category"), "Data Structures & Algorithms");
                        String difficulty = Objects.toString(q.get("difficulty"), "MEDIUM").toUpperCase();
                        int xp = "HARD".equalsIgnoreCase(difficulty) ? 120 : ("EASY".equalsIgnoreCase(difficulty) ? 80 : 100);
                        int coins = xp / 2;

                        Map<String, Object> puzzleMap = new HashMap<>(q);
                        String answer = Objects.toString(q.get("correctAnswer"), Objects.toString(q.get("answer"), ""));
                        puzzleMap.put("answer", answer);
                        puzzleMap.put("correctAnswer", answer);
                        String puzzleJson = objectMapper.writeValueAsString(puzzleMap);

                        loaded.add(ChallengeTemplate.builder()
                                .title(title)
                                .description("Master algorithmic concepts and problem solving in " + category + ".")
                                .type("dsa-master-quiz")
                                .difficulty(difficulty)
                                .xpReward(xp)
                                .coinReward(coins)
                                .puzzleJson(puzzleJson)
                                .build());
                    }
                    if (!loaded.isEmpty()) {
                        dsaTemplates = loaded;
                        log.info("Initialized {} daily challenge questions from DSA Master Quiz library.", dsaTemplates.size());
                    }
                }
            }
        } catch (Exception e) {
            log.warn("Could not load questions/dsa-master-quiz.json for daily challenge: {}", e.getMessage());
        }
    }

    @EventListener(ApplicationReadyEvent.class)
    public void onApplicationReady() {
        resetAllAttemptsForToday();
    }

    /**
     * Determines today's canonical challenge based on Asia/Kolkata date.
     * Always selects a deterministic DSA Master Quiz question.
     */
    private ChallengeTemplate getTemplateForDate(LocalDate date) {
        List<ChallengeTemplate> pool = (!dsaTemplates.isEmpty()) ? dsaTemplates : FALLBACK_DSA_CHALLENGES;
        long epochDay = date.toEpochDay();
        int index = (int) Math.floorMod(epochDay, pool.size());
        return pool.get(index);
    }

    /**
     * Scheduled job running at 12:00:00 AM IST every midnight.
     * Automatically creates and seeds the next daily challenge in the database.
     */
    @Scheduled(cron = "0 0 0 * * *", zone = "Asia/Kolkata")
    @Transactional
    public void generateDailyChallengeAtMidnight() {
        LocalDate todayIST = LocalDate.now(IST_ZONE);
        log.info("Midnight IST Trigger: Ensuring daily challenge for date {}", todayIST);
        ensureChallengeForDate(todayIST);
    }

    @Transactional
    public DailyChallenge ensureChallengeForDate(LocalDate date) {
        Optional<DailyChallenge> existing = dailyChallengeRepository.findByChallengeDate(date);
        if (existing.isPresent()) {
            DailyChallenge challenge = existing.get();
            // Ensure the daily challenge is always DSA Master Quiz
            if (!"dsa-master-quiz".equalsIgnoreCase(challenge.getType())) {
                ChallengeTemplate template = getTemplateForDate(date);
                challenge.setTitle(template.getTitle());
                challenge.setDescription(template.getDescription());
                challenge.setType("dsa-master-quiz");
                challenge.setDifficulty(template.getDifficulty());
                challenge.setXpReward(template.getXpReward());
                challenge.setCoinReward(template.getCoinReward());
                challenge.setPuzzle(template.getPuzzleJson());
                challenge = dailyChallengeRepository.save(challenge);
                log.info("Converted daily challenge on {} to DSA Master Quiz: {}", date, challenge.getTitle());
            }
            return challenge;
        }

        ChallengeTemplate template = getTemplateForDate(date);
        DailyChallenge challenge = DailyChallenge.builder()
                .challengeDate(date)
                .title(template.getTitle())
                .description(template.getDescription())
                .type("dsa-master-quiz")
                .difficulty(template.getDifficulty())
                .xpReward(template.getXpReward())
                .coinReward(template.getCoinReward())
                .puzzle(template.getPuzzleJson())
                .build();

        DailyChallenge saved = dailyChallengeRepository.save(challenge);
        log.info("Created new daily challenge for date {}: '{}' ({})", date, saved.getTitle(), saved.getType());
        return saved;
    }

    @Transactional
    public Map<String, Object> getTodayChallenge(Long userId) {
        LocalDate today = LocalDate.now(IST_ZONE);
        DailyChallenge challenge = ensureChallengeForDate(today);

        boolean completed = false;
        Boolean isCorrect = null;
        Integer xpEarned = null;
        Integer coinsEarned = null;

        if (userId != null) {
            Optional<UserDailyChallenge> attempt = userDailyChallengeRepository.findByUserIdAndDailyChallengeId(userId, challenge.getId());
            if (attempt.isPresent()) {
                if (Boolean.TRUE.equals(attempt.get().getIsCorrect())) {
                    completed = true;
                    isCorrect = true;
                    xpEarned = attempt.get().getXpEarned();
                    coinsEarned = attempt.get().getCoinsEarned();
                } else {
                    isCorrect = false;
                }
            }
        }

        Map<String, Object> response = new HashMap<>();
        response.put("id", challenge.getId());
        response.put("challengeDate", challenge.getChallengeDate());
        response.put("title", challenge.getTitle());
        response.put("description", challenge.getDescription());
        response.put("type", "dsa-master-quiz");
        response.put("gameSlug", "dsa-master-quiz");
        response.put("difficulty", challenge.getDifficulty());
        response.put("xpReward", challenge.getXpReward());
        response.put("coinReward", challenge.getCoinReward());
        response.put("puzzle", challenge.getPuzzle());
        response.put("completed", completed);
        response.put("completedToday", completed);
        response.put("isCorrect", isCorrect);
        response.put("xpEarned", xpEarned);
        response.put("coinsEarned", coinsEarned);
        response.put("expiresAt", today.plusDays(1).atStartOfDay(IST_ZONE).toInstant().toString());

        return response;
    }

    @Transactional
    public Map<String, Object> submitAnswer(Long userId, String answer) {
        LocalDate today = LocalDate.now(IST_ZONE);
        DailyChallenge challenge = ensureChallengeForDate(today);

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

        Optional<UserDailyChallenge> existingAttempt = userDailyChallengeRepository.findByUserIdAndDailyChallengeId(userId, challenge.getId());
        boolean wasAlreadySolved = existingAttempt.isPresent() && Boolean.TRUE.equals(existingAttempt.get().getIsCorrect());

        boolean isCorrect = false;
        String explanation = "Review the problem details.";
        String correctAnswer = "";

        try {
            JsonNode root = objectMapper.readTree(challenge.getPuzzle());
            if (root.has("correctAnswer")) {
                correctAnswer = root.get("correctAnswer").asText().trim();
            } else if (root.has("answer")) {
                correctAnswer = root.get("answer").asText().trim();
            }

            if (root.has("explanation")) {
                explanation = root.get("explanation").asText();
            }

            String userAns = (answer != null ? answer : "").trim();

            // 1. Direct match (case-insensitive, trimmed)
            if (!correctAnswer.isEmpty() && correctAnswer.equalsIgnoreCase(userAns)) {
                isCorrect = true;
            } else if (root.has("options") && root.get("options").isArray()) {
                JsonNode opts = root.get("options");
                List<String> optList = new ArrayList<>();
                for (JsonNode optNode : opts) {
                    optList.add(optNode.asText().trim());
                }

                // 2. User submitted option letter: "A", "B", "C", "D", "a", "b", "A)", "Option A"
                String cleanUser = userAns.replaceAll("^(?i)(option\\s*)?", "").replaceAll("[\\)\\.]+$", "").trim();
                if (cleanUser.length() == 1) {
                    char ch = Character.toUpperCase(cleanUser.charAt(0));
                    if (ch >= 'A' && ch <= 'D') {
                        int idx = ch - 'A';
                        if (idx < optList.size()) {
                            String optText = optList.get(idx);
                            if (optText.equalsIgnoreCase(correctAnswer)) {
                                isCorrect = true;
                            }
                        }
                    }
                }

                // 3. User submitted numeric index: "0", "1", "2", "3" or "1", "2", "3", "4"
                if (!isCorrect) {
                    try {
                        int num = Integer.parseInt(cleanUser);
                        if (num >= 0 && num < optList.size() && optList.get(num).equalsIgnoreCase(correctAnswer)) {
                            isCorrect = true;
                        } else if (num >= 1 && num <= optList.size() && optList.get(num - 1).equalsIgnoreCase(correctAnswer)) {
                            isCorrect = true;
                        }
                    } catch (NumberFormatException ignored) {}
                }

                // 4. In case correctAnswer in the database was saved as "A", "B", "C", "D"
                if (!isCorrect && correctAnswer.length() == 1) {
                    char corrCh = Character.toUpperCase(correctAnswer.charAt(0));
                    if (corrCh >= 'A' && corrCh <= 'D') {
                        int corrIdx = corrCh - 'A';
                        if (corrIdx < optList.size() && optList.get(corrIdx).equalsIgnoreCase(userAns)) {
                            isCorrect = true;
                        }
                    }
                }
            }
        } catch (Exception e) {
            log.error("Failed to parse puzzle json for daily challenge {}", challenge.getId(), e);
        }

        int xpAwarded = 0;
        int coinsAwarded = 0;

        if (isCorrect) {
            xpAwarded = challenge.getXpReward();
            coinsAwarded = challenge.getCoinReward();
            if (!wasAlreadySolved) {
                userService.updateProgression(user, xpAwarded, coinsAwarded, true, true);
            }
        } else {
            user.setLastPlayedDate(today);
            userRepository.save(user);
        }

        UserDailyChallenge userDaily = existingAttempt.orElseGet(() -> UserDailyChallenge.builder()
                .user(user)
                .dailyChallenge(challenge)
                .build());

        userDaily.setIsCorrect(isCorrect);
        userDaily.setXpEarned(xpAwarded);
        userDaily.setCoinsEarned(coinsAwarded);
        userDailyChallengeRepository.save(userDaily);

        Map<String, Object> result = new HashMap<>();
        result.put("isCorrect", isCorrect);
        result.put("correct", isCorrect);
        result.put("correctAnswer", correctAnswer);
        result.put("explanation", explanation);
        result.put("xpEarned", xpAwarded);
        result.put("coinsEarned", coinsAwarded);
        result.put("user", userService.convertToDto(user));

        return result;
    }

    @Transactional
    public void resetTodayAttempt(Long userId) {
        LocalDate today = LocalDate.now(IST_ZONE);
        DailyChallenge challenge = ensureChallengeForDate(today);
        if (userId != null) {
            userDailyChallengeRepository.deleteByUserIdAndDailyChallengeId(userId, challenge.getId());
            log.info("Reset daily challenge attempt for user {} on date {}", userId, today);
        }
    }

    @Transactional
    public void resetAllAttemptsForToday() {
        try {
            LocalDate today = LocalDate.now(IST_ZONE);
            Optional<DailyChallenge> dc = dailyChallengeRepository.findByChallengeDate(today);
            dc.ifPresent(challenge -> {
                userDailyChallengeRepository.deleteByDailyChallengeId(challenge.getId());
                log.info("Cleared user attempts for today's challenge id={}", challenge.getId());
            });
        } catch (Exception e) {
            log.warn("Could not reset today attempts: {}", e.getMessage());
        }
    }
}
