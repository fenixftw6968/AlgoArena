package com.mindmaze.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.mindmaze.dto.AttemptRequest;
import com.mindmaze.dto.AttemptResponse;
import com.mindmaze.dto.GameDto;
import com.mindmaze.dto.PuzzleDto;
import com.mindmaze.entity.Game;
import com.mindmaze.entity.GameAttempt;
import com.mindmaze.entity.Puzzle;
import com.mindmaze.entity.User;
import com.mindmaze.exception.BadRequestException;
import com.mindmaze.exception.ResourceNotFoundException;
import com.mindmaze.repository.GameAttemptRepository;
import com.mindmaze.repository.GameRepository;
import com.mindmaze.repository.PuzzleRepository;
import com.mindmaze.repository.UserRepository;
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

    private static final List<String> ACTIVE_SLUGS = List.of(
        "dsa-master-quiz",
        "logic-puzzle",
        "number-detective",
        "code-breaker"
    );

    @Transactional(readOnly = true)
    public List<GameDto> getAllGames() {
        return gameRepository.findAll().stream()
                .filter(g -> ACTIVE_SLUGS.contains(g.getSlug()))
                .map(this::convertToDto)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public GameDto getGameBySlug(String slug) {
        Game game = gameRepository.findBySlug(slug)
                .orElseThrow(() -> new ResourceNotFoundException("Game not found with slug: " + slug));
        return convertToDto(game);
    }

    @Transactional(readOnly = true)
    public List<PuzzleDto> getPuzzlesByGame(String slug, String difficulty) {
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
            userService.updateProgression(user, xpEarned, coinsEarned, false, false);
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

    private List<String> getTagsForSlug(String slug) {
        switch (slug) {
            case "dsa-master-quiz":
                return List.of("dsa", "c++", "algorithms", "trees", "dp", "complexity");
            case "logic-puzzle":
                return List.of("logic", "sequences", "deduction", "analogies", "reasoning");
            case "brain-teaser-battle":
                return List.of("riddles", "math", "aptitude", "lateral-thinking", "quick");
            case "number-detective":
                return List.of("numbers", "sequences", "logic", "math");
            case "memory-challenge":
                return List.of("memory", "observation", "attention", "visual");
            case "code-breaker":
                return List.of("logic", "deduction", "code", "mastermind");
            default:
                return List.of("brain-training");
        }
    }

    private PuzzleDto convertToPuzzleDto(Puzzle puzzle) {
        return PuzzleDto.builder()
                .id(puzzle.getId())
                .title(puzzle.getTitle())
                .difficulty(puzzle.getDifficulty())
                .content(puzzle.getContent())
                .correctAnswer(puzzle.getCorrectAnswer())
                .explanation(puzzle.getExplanation())
                .xpReward(puzzle.getXpReward())
                .orderIndex(puzzle.getOrderIndex())
                .build();
    }
}
