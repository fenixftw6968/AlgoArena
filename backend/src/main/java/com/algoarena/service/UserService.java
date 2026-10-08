package com.algoarena.service;

import com.algoarena.dto.AuthResponse;
import com.algoarena.dto.LoginRequest;
import com.algoarena.dto.SignupRequest;
import com.algoarena.dto.UserDto;
import com.algoarena.entity.User;
import com.algoarena.exception.BadRequestException;
import com.algoarena.exception.ResourceNotFoundException;
import com.algoarena.repository.UserRepository;
import com.algoarena.security.JwtUtil;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor
public class UserService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtil jwtUtil;
    private final AchievementService achievementService;

    private volatile String dummyPasswordHash;

    /** A valid BCrypt hash of a random value, used to equalise login timing for unknown accounts. */
    private String dummyPasswordHash() {
        String hash = dummyPasswordHash;
        if (hash == null) {
            hash = passwordEncoder.encode(java.util.UUID.randomUUID().toString());
            dummyPasswordHash = hash;
        }
        return hash;
    }

    private static final int[] XP_PER_LEVEL = {
        0, 100, 250, 450, 700, 1000, 1350, 1750, 2200, 2700,
        3250, 3850, 4500, 5200, 5950, 6750, 7600, 8500, 9450, 10450,
        11500, 12600, 13750, 14950, 16200, 17500
    };

    @Transactional
    public AuthResponse register(SignupRequest request) {
        // Usernames are public (leaderboard), so a specific message is fine. The e-mail check uses a
        // generic message that does not confirm that an address is registered.
        if (userRepository.existsByUsername(request.getUsername())) {
            throw new BadRequestException("Username is already taken");
        }
        if (userRepository.existsByEmail(request.getEmail())) {
            throw new BadRequestException("We could not create an account with these details. "
                    + "If you already have an account, please log in or reset your password.");
        }

        User user = User.builder()
                .username(request.getUsername())
                .email(request.getEmail())
                .password(passwordEncoder.encode(request.getPassword()))
                .xp(0)
                .level(1)
                .rank("Beginner")
                .coins(0)
                .currentStreak(0)
                .longestStreak(0)
                .gamesCompleted(0)
                .role("ROLE_USER")
                .build();

        user = userRepository.save(user);

        String token = jwtUtil.generateToken(user.getEmail(), user.getId(), user.getUsername());
        return new AuthResponse(token, convertToDto(user));
    }

    @Transactional(readOnly = true)
    public AuthResponse login(LoginRequest request) {
        User user = userRepository.findByEmail(request.getEmail()).orElse(null);
        // Always run one BCrypt verification, even for unknown e-mails, so response time does not reveal
        // whether an account exists. Both failures produce the identical message.
        boolean passwordOk = passwordEncoder.matches(request.getPassword(),
                user != null ? user.getPassword() : dummyPasswordHash());
        if (user == null || !passwordOk) {
            throw new BadRequestException("Invalid email or password");
        }

        String token = jwtUtil.generateToken(user.getEmail(), user.getId(), user.getUsername());
        return new AuthResponse(token, convertToDto(user));
    }

    @Transactional(readOnly = true)
    public UserDto getUserProfile(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));
        return convertToDto(user);
    }

    @Transactional
    public void updateProgression(User user, int xpGained, int coinsGained) {
        user.setXp(user.getXp() + xpGained);
        user.setCoins(user.getCoins() + coinsGained);

        // Update Level
        int oldLevel = user.getLevel();
        int newLevel = calculateLevel(user.getXp());
        user.setLevel(newLevel);

        // Update Rank
        user.setRank(calculateRank(newLevel));

        // Update Streak
        updateStreak(user);

        user.setGamesCompleted(user.getGamesCompleted() + 1);

        User saved = userRepository.save(user);
        achievementService.checkAndUnlockAchievements(saved);
    }

    private int calculateLevel(int xp) {
        int level = 1;
        for (int i = 0; i < XP_PER_LEVEL.length; i++) {
            if (xp >= XP_PER_LEVEL[i]) {
                level = i + 1;
            } else {
                break;
            }
        }
        return Math.min(level, 25);
    }

    private String calculateRank(int level) {
        if (level >= 21) return "Mastermind";
        if (level >= 17) return "Strategist";
        if (level >= 13) return "Detective";
        if (level >= 9) return "Solver";
        if (level >= 5) return "Thinker";
        return "Beginner";
    }

    private void updateStreak(User user) {
        LocalDate today = LocalDate.now();
        LocalDate lastPlayed = user.getLastPlayedDate();

        if (lastPlayed == null) {
            user.setCurrentStreak(1);
            user.setLongestStreak(Math.max(user.getLongestStreak(), 1));
        } else if (lastPlayed.isEqual(today.minusDays(1))) {
            int newStreak = user.getCurrentStreak() + 1;
            user.setCurrentStreak(newStreak);
            user.setLongestStreak(Math.max(user.getLongestStreak(), newStreak));
        } else if (!lastPlayed.isEqual(today)) {
            // Broke the streak, reset to 1
            user.setCurrentStreak(1);
            user.setLongestStreak(Math.max(user.getLongestStreak(), 1));
        }
        // If lastPlayed is equal to today, streak does not change
        user.setLastPlayedDate(today);
    }

    public UserDto convertToDto(User user) {
        // Build recent activities based on achievements and attempts
        List<UserDto.RecentActivity> activities = new ArrayList<>();
        
        // Add last 5 game attempts as recent activity
        if (user.getGameAttempts() != null) {
            user.getGameAttempts().stream()
                .sorted((a, b) -> b.getCreatedAt().compareTo(a.getCreatedAt()))
                .limit(5)
                .forEach(attempt -> {
                    String icon = "🎮";
                    if (attempt.getGame() != null && attempt.getGame().getIcon() != null) {
                        icon = attempt.getGame().getIcon();
                    }
                    activities.add(UserDto.RecentActivity.builder()
                        .id(attempt.getId())
                        .action("Played " + (attempt.getGame() != null ? attempt.getGame().getTitle() : "Game"))
                        .xpGained(attempt.getXpEarned())
                        .timestamp(attempt.getCreatedAt().toString())
                        .icon(icon)
                        .build());
                });
        }

        int rating = user.getCompetitiveRating() != null ? user.getCompetitiveRating() : 500;
        String compRank = com.algoarena.util.RankUtil.getRankName(rating);

        return UserDto.builder()
                .id(user.getId())
                .username(user.getUsername())
                .email(user.getEmail())
                .xp(user.getXp())
                .level(user.getLevel())
                .rank(user.getRank())
                .coins(user.getCoins())
                .currentStreak(user.getCurrentStreak())
                .longestStreak(user.getLongestStreak())
                .gamesCompleted(user.getGamesCompleted())
                .competitiveRating(rating)
                .competitiveRank(compRank)
                .matchesPlayed(user.getMatchesPlayed() != null ? user.getMatchesPlayed() : 0)
                .matchesWon(user.getMatchesWon() != null ? user.getMatchesWon() : 0)
                .createdAt(user.getCreatedAt())
                .recentActivity(activities)
                .build();
    }
}
