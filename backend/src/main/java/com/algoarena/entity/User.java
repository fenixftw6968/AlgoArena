package com.algoarena.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "users", indexes = {
    @Index(name = "idx_users_email",    columnList = "email",    unique = true),
    @Index(name = "idx_users_username", columnList = "username", unique = true)
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 50)
    private String username;

    @Column(nullable = false, unique = true, length = 150)
    private String email;

    @Column(nullable = false)
    private String password;  // BCrypt hashed

    // ── Progression ────────────────────────────────────────────
    @Column(nullable = false)
    @Builder.Default
    private Integer xp = 0;

    @Column(nullable = false)
    @Builder.Default
    private Integer level = 1;

    @Column(nullable = false, length = 20)
    @Builder.Default
    private String rank = "Beginner";

    @Column(nullable = false)
    @Builder.Default
    private Integer coins = 0;

    // ── Streaks ───────────────────────────────────────────────
    @Column(nullable = false)
    @Builder.Default
    private Integer currentStreak = 0;

    @Column(nullable = false)
    @Builder.Default
    private Integer longestStreak = 0;

    @Column
    private LocalDate lastPlayedDate;

    // ── Stats ─────────────────────────────────────────────────
    @Column(nullable = false, columnDefinition = "integer default 0")
    @Builder.Default
    private Integer gamesCompleted = 0;

    // LEGACY: column retained only for database compatibility (it is NOT NULL in existing databases).
    // No game feature reads or writes it any more.
    @Column(nullable = false, columnDefinition = "integer default 0")
    @Builder.Default
    private Integer mysteriesSolved = 0;

    @Column(nullable = false, columnDefinition = "integer default 0")
    @Builder.Default
    private Integer totalHintsUsed = 0;

    @Column(nullable = false, columnDefinition = "integer default 0")
    @Builder.Default
    private Integer noHintGames = 0;

    // ── Competitive Multiplayer ───────────────────────────────
    @Column(nullable = false, columnDefinition = "integer default 500")
    @Builder.Default
    private Integer competitiveRating = 500;

    @Column(nullable = false, columnDefinition = "integer default 0")
    @Builder.Default
    private Integer matchesPlayed = 0;

    @Column(nullable = false, columnDefinition = "integer default 0")
    @Builder.Default
    private Integer matchesWon = 0;

    // ── Timestamps ────────────────────────────────────────────
    @CreationTimestamp
    @Column(nullable = false, updatable = false, columnDefinition = "timestamp default current_timestamp")
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(nullable = false, columnDefinition = "timestamp default current_timestamp")
    private LocalDateTime updatedAt;

    // ── Roles ─────────────────────────────────────────────────
    @Column(nullable = false, length = 20, columnDefinition = "varchar(20) default 'ROLE_USER'")
    @Builder.Default
    private String role = "ROLE_USER";

    // ── Relationships ─────────────────────────────────────────
    @OneToMany(mappedBy = "user", cascade = CascadeType.ALL, fetch = FetchType.LAZY)
    @Builder.Default
    private List<GameAttempt> gameAttempts = new ArrayList<>();

    @OneToMany(mappedBy = "user", cascade = CascadeType.ALL, fetch = FetchType.LAZY)
    @Builder.Default
    private List<UserAchievement> userAchievements = new ArrayList<>();

    @OneToMany(mappedBy = "user", cascade = CascadeType.ALL, fetch = FetchType.LAZY)
    @Builder.Default
    private List<UserDailyChallenge> dailyChallenges = new ArrayList<>();
}
