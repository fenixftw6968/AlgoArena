package com.algoarena.repository;

import com.algoarena.entity.UserQuestionHistory;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface UserQuestionHistoryRepository extends JpaRepository<UserQuestionHistory, Long> {

    @Query("SELECT u.questionId FROM UserQuestionHistory u WHERE u.user.id = :userId AND LOWER(u.gameSlug) = LOWER(:gameSlug) AND UPPER(u.difficulty) = UPPER(:difficulty)")
    List<String> findUsedQuestionIds(@Param("userId") Long userId, @Param("gameSlug") String gameSlug, @Param("difficulty") String difficulty);

    @Query("SELECT u.questionId FROM UserQuestionHistory u WHERE u.user.id = :userId AND LOWER(u.gameSlug) = LOWER(:gameSlug)")
    List<String> findUsedQuestionIdsByGame(@Param("userId") Long userId, @Param("gameSlug") String gameSlug);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("DELETE FROM UserQuestionHistory u WHERE u.user.id = :userId AND LOWER(u.gameSlug) = LOWER(:gameSlug) AND UPPER(u.difficulty) = UPPER(:difficulty)")
    void deleteByUserIdAndGameSlugAndDifficulty(@Param("userId") Long userId, @Param("gameSlug") String gameSlug, @Param("difficulty") String difficulty);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("DELETE FROM UserQuestionHistory u WHERE u.user.id = :userId AND LOWER(u.gameSlug) = LOWER(:gameSlug)")
    void deleteByUserIdAndGameSlug(@Param("userId") Long userId, @Param("gameSlug") String gameSlug);

    @Query("SELECT COUNT(u) FROM UserQuestionHistory u WHERE u.user.id = :userId AND LOWER(u.gameSlug) = LOWER(:gameSlug) AND UPPER(u.difficulty) = UPPER(:difficulty)")
    long countByUserIdAndGameSlugAndDifficulty(@Param("userId") Long userId, @Param("gameSlug") String gameSlug, @Param("difficulty") String difficulty);

    boolean existsByUserIdAndGameSlugAndDifficultyAndQuestionId(Long userId, String gameSlug, String difficulty, String questionId);
}
