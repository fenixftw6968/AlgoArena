package com.algoarena.service;

import com.algoarena.dto.QuestionHistoryDto;
import com.algoarena.entity.User;
import com.algoarena.entity.UserQuestionHistory;
import com.algoarena.exception.BadRequestException;
import com.algoarena.exception.ResourceNotFoundException;
import com.algoarena.repository.UserQuestionHistoryRepository;
import com.algoarena.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class QuestionHistoryService {

    private final UserQuestionHistoryRepository questionHistoryRepository;
    private final UserRepository userRepository;
    private final org.springframework.jdbc.core.JdbcTemplate jdbcTemplate;

    @Transactional
    public QuestionHistoryDto.SelectionResponse selectAndReserveQuestions(Long userId, QuestionHistoryDto.SelectionRequest request) {
        if (request.getGameSlug() == null || request.getGameSlug().trim().isEmpty()) {
            throw new BadRequestException("gameSlug is required");
        }

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found with id: " + userId));

        String gameSlug = request.getGameSlug().trim().toLowerCase();
        String difficulty = (request.getDifficulty() != null && !request.getDifficulty().trim().isEmpty())
                ? request.getDifficulty().trim().toUpperCase()
                : "ALL";

        List<String> rawCandidates = request.getCandidateIds() != null ? request.getCandidateIds() : List.of();
        List<String> candidates = new ArrayList<>(new LinkedHashSet<>(rawCandidates));
        int defaultCount = ("dsa-master-quiz".equalsIgnoreCase(gameSlug) || "number-detective".equalsIgnoreCase(gameSlug)) ? 5 : 10;
        int requestedCount = (request.getCount() != null && request.getCount() > 0) ? request.getCount() : defaultCount;

        if (candidates.isEmpty()) {
            return QuestionHistoryDto.SelectionResponse.builder()
                    .gameSlug(gameSlug)
                    .difficulty(difficulty)
                    .selectedIds(List.of())
                    .cycleReset(false)
                    .totalUsed(0)
                    .poolSize(0)
                    .build();
        }

        // 1. Fetch currently recorded used question IDs for this user, game, and difficulty
        List<String> usedIds = questionHistoryRepository.findUsedQuestionIds(userId, gameSlug, difficulty);
        Set<String> usedSet = new HashSet<>(usedIds);

        // 2. Identify unplayed questions
        List<String> unplayed = candidates.stream()
                .filter(id -> !usedSet.contains(id))
                .collect(Collectors.toList());

        boolean cycleReset = false;

        // 3. If unplayed questions are exhausted or fewer than requested, reset the question cycle
        if (unplayed.size() < requestedCount) {
            log.info("Exhausted unplayed questions for user={}, game={}, diff={}. Resetting question cycle.", userId, gameSlug, difficulty);
            questionHistoryRepository.deleteByUserIdAndGameSlugAndDifficulty(userId, gameSlug, difficulty);
            unplayed = new ArrayList<>(candidates);
            cycleReset = true;
        }

        // 4. Shuffle unplayed candidates and pick requested count
        Collections.shuffle(unplayed);
        int takeCount = Math.min(requestedCount, unplayed.size());
        List<String> selectedIds = new ArrayList<>(unplayed.subList(0, takeCount));

        // 5. Fast batch insert via single round-trip with ON CONFLICT DO NOTHING
        if (!selectedIds.isEmpty()) {
            String insertSql = "INSERT INTO user_question_history (user_id, game_slug, difficulty, question_id, played_at) " +
                               "VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP) " +
                               "ON CONFLICT (user_id, game_slug, difficulty, question_id) DO NOTHING";
            jdbcTemplate.batchUpdate(insertSql, new org.springframework.jdbc.core.BatchPreparedStatementSetter() {
                @Override
                public void setValues(java.sql.PreparedStatement ps, int i) throws java.sql.SQLException {
                    ps.setLong(1, userId);
                    ps.setString(2, gameSlug);
                    ps.setString(3, difficulty);
                    ps.setString(4, selectedIds.get(i));
                }

                @Override
                public int getBatchSize() {
                    return selectedIds.size();
                }
            });
        }

        int totalUsed = cycleReset ? selectedIds.size() : usedSet.size() + selectedIds.size();

        return QuestionHistoryDto.SelectionResponse.builder()
                .gameSlug(gameSlug)
                .difficulty(difficulty)
                .selectedIds(selectedIds)
                .cycleReset(cycleReset)
                .totalUsed(totalUsed)
                .poolSize(candidates.size())
                .build();
    }

    @Transactional(readOnly = true)
    public QuestionHistoryDto.HistoryResponse getQuestionHistory(Long userId, String gameSlug, String difficulty) {
        if (gameSlug == null || gameSlug.trim().isEmpty()) {
            throw new BadRequestException("gameSlug is required");
        }
        String normGame = gameSlug.trim().toLowerCase();
        String normDiff = (difficulty != null && !difficulty.trim().isEmpty())
                ? difficulty.trim().toUpperCase()
                : "ALL";

        List<String> usedIds;
        if ("ALL".equalsIgnoreCase(normDiff)) {
            usedIds = questionHistoryRepository.findUsedQuestionIdsByGame(userId, normGame);
        } else {
            usedIds = questionHistoryRepository.findUsedQuestionIds(userId, normGame, normDiff);
        }

        return QuestionHistoryDto.HistoryResponse.builder()
                .gameSlug(normGame)
                .difficulty(normDiff)
                .usedQuestionIds(usedIds)
                .totalUsed(usedIds.size())
                .build();
    }

    @Transactional
    public void recordUsedQuestions(Long userId, QuestionHistoryDto.RecordRequest request) {
        if (request.getGameSlug() == null || request.getGameSlug().trim().isEmpty()) {
            throw new BadRequestException("gameSlug is required");
        }
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found with id: " + userId));

        String gameSlug = request.getGameSlug().trim().toLowerCase();
        String difficulty = (request.getDifficulty() != null && !request.getDifficulty().trim().isEmpty())
                ? request.getDifficulty().trim().toUpperCase()
                : "ALL";

        List<String> qIds = request.getQuestionIds() != null ? request.getQuestionIds() : List.of();
        if (!qIds.isEmpty()) {
            String insertSql = "INSERT INTO user_question_history (user_id, game_slug, difficulty, question_id, played_at) " +
                               "VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP) " +
                               "ON CONFLICT (user_id, game_slug, difficulty, question_id) DO NOTHING";
            jdbcTemplate.batchUpdate(insertSql, new org.springframework.jdbc.core.BatchPreparedStatementSetter() {
                @Override
                public void setValues(java.sql.PreparedStatement ps, int i) throws java.sql.SQLException {
                    ps.setLong(1, userId);
                    ps.setString(2, gameSlug);
                    ps.setString(3, difficulty);
                    ps.setString(4, qIds.get(i));
                }

                @Override
                public int getBatchSize() {
                    return qIds.size();
                }
            });
        }
    }

    @Transactional
    public void resetHistory(Long userId, String gameSlug, String difficulty) {
        if (gameSlug == null || gameSlug.trim().isEmpty()) {
            throw new BadRequestException("gameSlug is required");
        }
        String normGame = gameSlug.trim().toLowerCase();
        String normDiff = (difficulty != null && !difficulty.trim().isEmpty())
                ? difficulty.trim().toUpperCase()
                : "ALL";

        if ("ALL".equalsIgnoreCase(normDiff)) {
            questionHistoryRepository.deleteByUserIdAndGameSlug(userId, normGame);
        } else {
            questionHistoryRepository.deleteByUserIdAndGameSlugAndDifficulty(userId, normGame, normDiff);
        }
        log.info("Explicitly reset question history for user={}, game={}, diff={}", userId, normGame, normDiff);
    }
}
