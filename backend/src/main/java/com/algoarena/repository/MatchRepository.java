package com.algoarena.repository;

import com.algoarena.entity.Match;
import com.algoarena.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

import org.springframework.data.jpa.repository.Lock;
import jakarta.persistence.LockModeType;
import java.util.Optional;

@Repository
public interface MatchRepository extends JpaRepository<Match, String> {

    @Query("SELECT m FROM Match m WHERE (m.player1 = :user OR m.player2 = :user) AND m.status = 'FINISHED' ORDER BY m.createdAt DESC")
    List<Match> findRecentMatchesByUser(@Param("user") User user);

    @Query("SELECT m FROM Match m WHERE m.status = 'WAITING' AND m.mode = 'RANKED' AND m.gameSlug = :gameSlug AND m.player1 != :user")
    List<Match> findOpenRankedMatches(@Param("gameSlug") String gameSlug, @Param("user") User user);

    // Native query using FOR UPDATE SKIP LOCKED to atomically claim one waiting match slot
    @Query(value = "SELECT * FROM public.matches WHERE status = 'WAITING' AND mode = 'RANKED' AND game_slug = :gameSlug AND player1_id != :userId AND created_at >= :cutoff ORDER BY created_at ASC LIMIT 1 FOR UPDATE SKIP LOCKED", nativeQuery = true)
    Optional<Match> findAndLockWaitingRankedMatch(@Param("gameSlug") String gameSlug, @Param("userId") Long userId, @Param("cutoff") java.time.LocalDateTime cutoff);

    @Query("SELECT m FROM Match m WHERE m.status = 'WAITING' AND m.mode = 'RANKED' AND m.gameSlug = :gameSlug AND m.player1 != :user AND m.createdAt >= :cutoff ORDER BY m.createdAt ASC")
    List<Match> findRecentOpenRankedMatches(@Param("gameSlug") String gameSlug, @Param("user") User user, @Param("cutoff") java.time.LocalDateTime cutoff);

    @Query("SELECT m FROM Match m WHERE m.status = 'WAITING' AND m.mode = 'FRIEND' AND m.player2 = :user ORDER BY m.createdAt DESC")
    List<Match> findPendingInvitationsForUser(@Param("user") User user);

    @Query("SELECT m FROM Match m WHERE m.status = 'WAITING' AND (m.player1 = :user OR m.player2 = :user)")
    List<Match> findWaitingMatchesByUser(@Param("user") User user);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT m FROM Match m WHERE m.id = :id")
    Optional<Match> findByIdWithLock(@Param("id") String id);

    @Query("SELECT m FROM Match m WHERE (m.player1 = :user OR m.player2 = :user) AND m.gameSlug = :gameSlug AND m.status IN ('WAITING', 'READY', 'IN_PROGRESS') AND m.createdAt >= :cutoff ORDER BY m.createdAt DESC")
    List<Match> findActiveMatchesByUserAndGame(@Param("user") User user, @Param("gameSlug") String gameSlug, @Param("cutoff") java.time.LocalDateTime cutoff);

    // Find the user's own waiting ranked match (for idempotent polling)
    @Query("SELECT m FROM Match m WHERE m.player1 = :user AND m.status = 'WAITING' AND m.mode = 'RANKED' AND m.gameSlug = :gameSlug AND m.createdAt >= :cutoff ORDER BY m.createdAt DESC")
    List<Match> findMyWaitingRankedMatch(@Param("user") User user, @Param("gameSlug") String gameSlug, @Param("cutoff") java.time.LocalDateTime cutoff);
}
