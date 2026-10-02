package com.mindmaze.repository;

import com.mindmaze.entity.UserDailyChallenge;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface UserDailyChallengeRepository extends JpaRepository<UserDailyChallenge, Long> {
    boolean existsByUserIdAndDailyChallengeId(Long userId, Long dailyChallengeId);
    Optional<UserDailyChallenge> findByUserIdAndDailyChallengeId(Long userId, Long dailyChallengeId);

    @Modifying
    @Query("DELETE FROM UserDailyChallenge udc WHERE udc.user.id = :userId AND udc.dailyChallenge.id = :dailyChallengeId")
    void deleteByUserIdAndDailyChallengeId(@Param("userId") Long userId, @Param("dailyChallengeId") Long dailyChallengeId);

    @Modifying
    @Query("DELETE FROM UserDailyChallenge udc WHERE udc.dailyChallenge.id = :dailyChallengeId")
    void deleteByDailyChallengeId(@Param("dailyChallengeId") Long dailyChallengeId);
}
