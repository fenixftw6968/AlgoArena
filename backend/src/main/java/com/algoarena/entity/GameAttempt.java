package com.algoarena.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "game_attempts", indexes = {
    @Index(name = "idx_attempts_user",   columnList = "user_id"),
    @Index(name = "idx_attempts_puzzle", columnList = "puzzle_id"),
    @Index(name = "idx_attempts_game",   columnList = "game_id")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class GameAttempt {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    @com.fasterxml.jackson.annotation.JsonIgnore
    private User user;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "game_id", nullable = false)
    private Game game;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "puzzle_id")
    private Puzzle puzzle;

    @Column(nullable = false)
    @Builder.Default
    private Boolean isCorrect = false;

    @Column(length = 500)
    private String userAnswer;

    @Column(nullable = false)
    @Builder.Default
    private Boolean hintUsed = false;

    @Column(nullable = false)
    @Builder.Default
    private Integer xpEarned = 0;

    @Column(nullable = false)
    @Builder.Default
    private Integer coinsEarned = 0;

    @Column
    private Integer timeTakenSeconds;

    @Column(nullable = false, length = 10)
    @Builder.Default
    private String difficulty = "MEDIUM";

    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;
}
