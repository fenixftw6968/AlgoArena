package com.algoarena.repository;

import com.algoarena.entity.UserAchievement;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface UserAchievementRepository extends JpaRepository<UserAchievement, Long> {
    List<UserAchievement> findByUserId(Long userId);
    boolean existsByUserIdAndAchievementId(Long userId, Long achievementId);
    boolean existsByUserIdAndAchievementAchievementKey(Long userId, String achievementKey);

    @Query("SELECT ua FROM UserAchievement ua JOIN FETCH ua.achievement WHERE ua.user.id = :userId ORDER BY ua.unlockedAt DESC")
    List<UserAchievement> findByUserIdWithAchievements(Long userId);
}
