package com.algoarena.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.LocalDateTime;

@Entity
@Table(name = "puzzles", indexes = {
    @Index(name = "idx_puzzles_game",       columnList = "game_id"),
    @Index(name = "idx_puzzles_difficulty", columnList = "difficulty")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Puzzle {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "game_id", nullable = false)
    private Game game;

    @Column(nullable = false, length = 200)
    private String title;

    @Column(nullable = false, length = 10)
    @Builder.Default
    private String difficulty = "MEDIUM";

    /**
     * JSONB column: stores the full puzzle data
     * Example for Number Detective:
     * {
     *   "question": "2, 6, 12, 20, 30, ?",
     *   "hint": "Look at the differences.",
     *   "tags": ["arithmetic", "second-difference"]
     * }
     */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb", nullable = false)
    private String content;

    /**
     * JSONB column: stores the correct answer(s)
     * Example: { "answer": "42" }
     * or for multiple-choice: { "answer": "C", "type": "choice" }
     */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb", nullable = false)
    private String correctAnswer;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String explanation;

    @Column(nullable = false)
    @Builder.Default
    private Integer xpReward = 25;

    @Column(nullable = false)
    @Builder.Default
    private Integer orderIndex = 0;

    @Column(nullable = false)
    @Builder.Default
    private Boolean isActive = true;

    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;
}
