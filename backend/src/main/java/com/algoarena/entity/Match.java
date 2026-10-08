package com.algoarena.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "matches", indexes = {
    @Index(name = "idx_matches_players", columnList = "player1_id, player2_id"),
    @Index(name = "idx_matches_status", columnList = "status"),
    @Index(name = "idx_matches_created", columnList = "createdAt")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Match {

    public enum MatchMode {
        RANKED,
        FRIEND,
        PRACTICE
    }

    public enum MatchStatus {
        WAITING,
        READY,
        IN_PROGRESS,
        FINISHED,
        CANCELLED
    }

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private String id;

    @Column(nullable = false, length = 50)
    private String gameSlug; // one of SupportedGames.SLUGS, e.g. "number-detective"

    @Column(length = 20)
    private String difficulty; // e.g. "EASY", "MEDIUM", "HARD"

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    @Builder.Default
    private MatchMode mode = MatchMode.RANKED;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    @Builder.Default
    private MatchStatus status = MatchStatus.WAITING;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "player1_id", nullable = false)
    private User player1;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "player2_id")
    private User player2;

    private Long winnerId; // Null if draw or ongoing

    // Scores and metrics
    @Column(nullable = false, columnDefinition = "integer default 0")
    @Builder.Default
    private Integer player1Score = 0;

    @Column(nullable = false, columnDefinition = "integer default 0")
    @Builder.Default
    private Integer player2Score = 0;

    private Integer player1TimeSeconds;
    private Integer player2TimeSeconds;

    private Integer player1Mistakes;
    private Integer player2Mistakes;

    @Builder.Default
    private Boolean player1Finished = false;

    @Builder.Default
    private Boolean player2Finished = false;

    @Builder.Default
    private Boolean player1Ready = false;

    @Builder.Default
    private Boolean player2Ready = false;

    // Rating changes
    private Integer player1RatingBefore;
    private Integer player2RatingBefore;
    private Integer player1RatingChange;
    private Integer player2RatingChange;

    @Builder.Default
    private Boolean isBotMatch = false;

    private String cancelledReason; // e.g. "DECLINED", "CANCELLED_BY_HOST", "ABANDONED"

    // Challenge payload (JSON string with puzzles/scenes generated server-side)
    @Column(columnDefinition = "TEXT")
    private String challengeData;

    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(nullable = false)
    private LocalDateTime updatedAt;

    private LocalDateTime startedAt;
    private LocalDateTime finishedAt;
}
