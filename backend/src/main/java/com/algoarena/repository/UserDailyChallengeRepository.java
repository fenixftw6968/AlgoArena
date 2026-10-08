package com.algoarena.repository;

import com.algoarena.entity.UserDailyChallenge;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface UserDailyChallengeRepository extends JpaRepository<UserDailyChallenge, Long> {
    boolean existsByUserIdAndDailyChallengeId(Long userId, Long dailyChallengeId);
    Optional<UserDailyChallenge> findByUserIdAndDailyChallengeId(Long userId, Long dailyChallengeId);
}
