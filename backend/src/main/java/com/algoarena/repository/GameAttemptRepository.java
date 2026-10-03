package com.algoarena.repository;

import com.algoarena.entity.GameAttempt;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface GameAttemptRepository extends JpaRepository<GameAttempt, Long> {

    List<GameAttempt> findByUserIdOrderByCreatedAtDesc(Long userId);

    List<GameAttempt> findTop10ByUserIdOrderByCreatedAtDesc(Long userId);

    long countByUserIdAndIsCorrectTrue(Long userId);

    long countByUserIdAndHintUsedFalseAndIsCorrectTrue(Long userId);

    @Query("SELECT COUNT(DISTINCT ga.game.id) FROM GameAttempt ga WHERE ga.user.id = :userId AND ga.isCorrect = true")
    long countDistinctGamesCompletedByUser(Long userId);

    @Query("SELECT ga FROM GameAttempt ga JOIN FETCH ga.game WHERE ga.user.id = :userId ORDER BY ga.createdAt DESC")
    List<GameAttempt> findRecentByUserWithGame(Long userId);

    @Query("SELECT COUNT(ga) FROM GameAttempt ga WHERE ga.user.id = :userId AND ga.createdAt >= :since")
    long countRecentAttemptsByUser(Long userId, LocalDateTime since);
}
