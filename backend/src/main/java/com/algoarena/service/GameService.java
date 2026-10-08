package com.algoarena.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.algoarena.dto.AttemptRequest;
import com.algoarena.dto.AttemptResponse;
import com.algoarena.dto.GameDto;
import com.algoarena.dto.PuzzleDto;
import com.algoarena.entity.Game;
import com.algoarena.entity.GameAttempt;
import com.algoarena.entity.Puzzle;
import com.algoarena.entity.User;
import com.algoarena.exception.BadRequestException;
import com.algoarena.exception.ResourceNotFoundException;
import com.algoarena.repository.GameAttemptRepository;
import com.algoarena.repository.GameRepository;
import com.algoarena.repository.PuzzleRepository;
import com.algoarena.repository.UserRepository;
import com.algoarena.util.AnswerRedactor;
import com.algoarena.util.SupportedGames;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class GameService {

    private final GameRepository gameRepository;
    private final PuzzleRepository puzzleRepository;
    private final GameAttemptRepository gameAttemptRepository;
    private final UserRepository userRepository;
    private final UserService userService;
    private final ObjectMapper objectMapper;

    @Transactional(readOnly = true)
    public List<GameDto> getAllGames() {
        return gameRepository.findAll().stream()
                .filter(g -> SupportedGames.isSupported(g.getSlug()))
                .map(this::convertToDto)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public GameDto getGameBySlug(String slug) {
        requireSupported(slug);
        Game game = gameRepository.findBySlug(slug)
                .orElseThrow(() -> new ResourceNotFoundException("Game not found with slug: " + slug));
        return convertToDto(game);
    }

    @Transactional(readOnly = true)
    public List<PuzzleDto> getPuzzlesByGame(String slug, String difficulty) {
        requireSupported(slug);
        List<Puzzle> puzzles;
        if (difficulty != null && !difficulty.trim().isEmpty()) {
            puzzles = puzzleRepository.findRandomByGameSlugAndDifficulty(slug, difficulty.toUpperCase());
        } else {
            puzzles = puzzleRepository.findRandomByGameSlug(slug);
        }
        return puzzles.stream()
                .map(this::convertToPuzzleDto)
                .collect(Collectors.toList());
    }

    @Transactional
    public AttemptResponse submitAttempt(Long userId, String slug, AttemptRequest request) {
        requireSupported(slug);
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));
        Game game = gameRepository.findBySlug(slug)
                .orElseThrow(() -> new ResourceNotFoundException("Game not found"));
        Puzzle puzzle = null;
        if (request.getPuzzleId() != null) {
            try {
                puzzle = puzzleRepository.findById(request.getPuzzleId()).orElse(null);
            } catch (Exception ignored) {}
        }

        boolean isCorrect = true;
        String explanation = puzzle != null ? puzzle.getExplanation() : "Great effort!";
        String correctAnsStr = "";

        if (puzzle != null) {
            try {
                JsonNode node = objectMapper.readTree(puzzle.getCorrectAnswer());
                if (node.has("answer")) {
                    correctAnsStr = node.get("answer").asText();
                    isCorrect = correctAnsStr.trim().equalsIgnoreCase((request.getUserAnswer() != null ? request.getUserAnswer() : "").trim());
                }
            } catch (Exception e) {
                log.error("Failed to parse correct answer JSON for puzzle id: {}", puzzle.getId(), e);
            }
        }

        int xpEarned = 0;
        int coinsEarned = 0;

        if (isCorrect) {
            int baseXP = puzzle != null ? puzzle.getXpReward() : 25;
            xpEarned = Boolean.TRUE.equals(request.getHintUsed()) ? (int) Math.round(baseXP * 0.7) : baseXP;
            coinsEarned = (int) Math.round(xpEarned / 2.5);
            if (coinsEarned == 0) coinsEarned = 1;
        }

        // Save Attempt
        GameAttempt attempt = GameAttempt.builder()
                .user(user)
                .game(game)
                .puzzle(puzzle)
                .isCorrect(isCorrect)
                .userAnswer(request.getUserAnswer())
                .hintUsed(Boolean.TRUE.equals(request.getHintUsed()))
                .xpEarned(xpEarned)
                .coinsEarned(coinsEarned)
                .timeTakenSeconds(request.getTimeTakenSeconds() != null ? request.getTimeTakenSeconds() : 0)
                .difficulty(puzzle != null ? puzzle.getDifficulty() : "MEDIUM")
                .build();

        gameAttemptRepository.save(attempt);

        // Update User Profile Progression if correct
        if (isCorrect) {
            // Check if hints were used
            if (!request.getHintUsed()) {
                user.setNoHintGames(user.getNoHintGames() + 1);
            }
            userService.updateProgression(user, xpEarned, coinsEarned);
        }

        return AttemptResponse.builder()
                .isCorrect(isCorrect)
                .correctAnswer(correctAnsStr)
                .explanation(explanation)
                .xpEarned(xpEarned)
                .coinsEarned(coinsEarned)
                .user(userService.convertToDto(user))
                .build();
    }

    private GameDto convertToDto(Game game) {
        // Map rewards
        Map<String, Integer> xpReward = Map.of(
                "easy", game.getXpRewardEasy(),
                "medium", game.getXpRewardMedium(),
                "hard", game.getXpRewardHard()
        );

        // Fetch tags based on slug
        List<String> tags = getTagsForSlug(game.getSlug());

        return GameDto.builder()
                .id(game.getId())
                .slug(game.getSlug())
                .title(game.getTitle())
                .description(game.getDescription())
                .category(game.getCategory())
                .icon(game.getIcon())
                .difficulty(game.getDifficulty())
                .xpReward(xpReward)
                .totalPlayers(game.getTotalPlayers())
                .completionRate(game.getCompletionRate())
                .isUnlocked(game.getIsUnlocked())
                .isNew(game.getIsNew())
                .isFeatured(game.getIsFeatured())
                .estimatedTime(game.getEstimatedTime())
                .tags(tags)
                .build();
    }

    /** Retired / unknown games behave as if they do not exist (404), even if a stale row is still in the database. */
    private static void requireSupported(String slug) {
        if (!SupportedGames.isSupported(slug)) {
            throw new ResourceNotFoundException("Game not found with slug: " + slug);
        }
    }

    private List<String> getTagsForSlug(String slug) {
        switch (slug) {
            case "dsa-master-quiz":
                return List.of("dsa", "c++", "algorithms", "trees", "dp", "complexity");
            case "logic-puzzle":
                return List.of("logic", "sequences", "deduction", "analogies", "reasoning");
            case "number-detective":
                return List.of("numbers", "sequences", "logic", "math");
            case "code-breaker":
                return List.of("logic", "deduction", "code", "mastermind");
            default:
                return List.of();
        }
    }

    /**
     * INTERNAL: full (answer-bearing) question maps built from DB puzzles for a match. The result
     * is stored server-side only (see {@link MatchChallenge}); clients only ever see the
     * sanitised view. Puzzles whose content or answer cannot be parsed are skipped, because they
     * could not be graded.
     */
    @Transactional(readOnly = true)
    public List<Map<String, Object>> getPuzzlesForMatch(String slug, String difficulty) {
        List<Puzzle> puzzles = (difficulty != null && !difficulty.trim().isEmpty())
                ? puzzleRepository.findRandomByGameSlugAndDifficulty(slug, difficulty.toUpperCase())
                : puzzleRepository.findRandomByGameSlug(slug);

        List<Map<String, Object>> questions = new ArrayList<>();
        for (Puzzle puzzle : puzzles) {
            try {
                Map<String, Object> question = new java.util.LinkedHashMap<>(objectMapper.readValue(
                        puzzle.getContent(), new com.fasterxml.jackson.core.type.TypeReference<Map<String, Object>>() { }));
                JsonNode answer = objectMapper.readTree(puzzle.getCorrectAnswer());
                String correct = answer.hasNonNull("answer") ? answer.get("answer").asText() : "";
                if (correct.isBlank()) {
                    continue;
                }
                question.put("id", puzzle.getId());
                question.put("title", puzzle.getTitle());
                question.put("difficulty", puzzle.getDifficulty());
                question.put("correctAnswer", correct);
                question.put("explanation", puzzle.getExplanation());
                questions.add(question);
            } catch (Exception e) {
                log.warn("Skipping puzzle {} for match: unparseable content/answer ({})",
                        puzzle.getId(), e.getClass().getSimpleName());
            }
        }
        return questions;
    }

    private PuzzleDto convertToPuzzleDto(Puzzle puzzle) {
        return PuzzleDto.builder()
                .id(puzzle.getId())
                .title(puzzle.getTitle())
                .difficulty(puzzle.getDifficulty())
                .content(AnswerRedactor.redactJson(puzzle.getContent()))
                .xpReward(puzzle.getXpReward())
                .orderIndex(puzzle.getOrderIndex())
                .build();
    }
}
