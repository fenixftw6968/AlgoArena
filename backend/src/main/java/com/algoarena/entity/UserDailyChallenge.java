package com.algoarena.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "user_daily_challenges",
    uniqueConstraints = @UniqueConstraint(columnNames = {"user_id", "daily_challenge_id"}))
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UserDailyChallenge {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    @com.fasterxml.jackson.annotation.JsonIgnore
    private User user;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "daily_challenge_id", nullable = false)
    private DailyChallenge dailyChallenge;

    @Column(nullable = false)
    @Builder.Default
    private Boolean isCorrect = false;

    @Column(nullable = false)
    @Builder.Default
    private Integer xpEarned = 0;

    @Column(nullable = false)
    @Builder.Default
    private Integer coinsEarned = 0;

    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private LocalDateTime completedAt;
}
