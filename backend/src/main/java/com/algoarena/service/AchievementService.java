package com.algoarena.service;

import com.algoarena.entity.Achievement;
import com.algoarena.entity.User;
import com.algoarena.entity.UserAchievement;
import com.algoarena.repository.AchievementRepository;
import com.algoarena.repository.UserAchievementRepository;
import com.algoarena.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class AchievementService {

    private final AchievementRepository achievementRepository;
    private final UserAchievementRepository userAchievementRepository;
    private final UserRepository userRepository;

    /** Requirement types that can still be earned. Anything else in the table is legacy and inert. */
    private static final java.util.Set<String> SUPPORTED_REQUIREMENTS =
            java.util.Set.of("games_completed", "no_hint_games", "streak", "level", "coins");

    @Transactional(readOnly = true)
    public List<Achievement> getAllAchievements() {
        // Rows created for retired features may still exist in the database; never show them.
        return achievementRepository.findAll().stream()
                .filter(a -> SUPPORTED_REQUIREMENTS.contains(a.getRequirementType()))
                .toList();
    }

    @Transactional(readOnly = true)
    public List<UserAchievement> getUserAchievements(Long userId) {
        return userAchievementRepository.findByUserId(userId);
    }

    @Transactional
    public void checkAndUnlockAchievements(User user) {
        // Fetch already unlocked achievements
        List<UserAchievement> unlocked = userAchievementRepository.findByUserId(user.getId());
        Set<Long> unlockedIds = unlocked.stream()
                .map(ua -> ua.getAchievement().getId())
                .collect(Collectors.toSet());

        // Fetch all achievements
        List<Achievement> allAchievements = achievementRepository.findAll();

        for (Achievement achievement : allAchievements) {
            if (unlockedIds.contains(achievement.getId())) {
                continue; // Already unlocked
            }

            boolean qualify = checkRequirement(user, achievement);
            if (qualify) {
                unlock(user, achievement);
            }
        }
    }

    private boolean checkRequirement(User user, Achievement achievement) {
        String type = achievement.getRequirementType();
        int value = achievement.getRequirementValue();

        switch (type) {
            case "games_completed":
                return user.getGamesCompleted() >= value;
            case "no_hint_games":
                return user.getNoHintGames() >= value;
            case "streak":
                return Math.max(user.getCurrentStreak(), user.getLongestStreak()) >= value;
            case "level":
                return user.getLevel() >= value;
            case "coins":
                return user.getCoins() >= value;
            default:
                log.debug("Ignoring achievement with unsupported requirement type: {}", type);
                return false;
        }
    }

    private void unlock(User user, Achievement achievement) {
        log.info("Unlocking achievement {} for user {}", achievement.getTitle(), user.getUsername());
        
        UserAchievement userAchievement = UserAchievement.builder()
                .user(user)
                .achievement(achievement)
                .build();
        
        userAchievementRepository.save(userAchievement);

        // Reward User
        user.setXp(user.getXp() + achievement.getXpReward());
        userRepository.save(user);
    }
}
