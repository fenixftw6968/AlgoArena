package com.algoarena.dto;

import lombok.*;

import java.time.LocalDateTime;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class MatchDto {
    private String id;
    private String gameSlug;
    private String difficulty;
    private String mode;
    private String status;

    private Long player1Id;
    private String player1Username;
    private Integer player1Rating;
    private String player1Rank;
    private Integer player1Score;
    private Integer player1TimeSeconds;
    private Integer player1RatingChange;
    private Boolean player1Ready;
    private Boolean player1Finished;

    private Long player2Id;
    private String player2Username;
    private Integer player2Rating;
    private String player2Rank;
    private Integer player2Score;
    private Integer player2TimeSeconds;
    private Integer player2RatingChange;
    private Boolean player2Ready;
    private Boolean player2Finished;

    private Long winnerId;
    private String winnerUsername;
    private String challengeData;
    private Boolean isBotMatch;
    private String cancelledReason;

    private LocalDateTime createdAt;
    private LocalDateTime startedAt;
    private LocalDateTime finishedAt;

    private Long startedAtMillis;
    private Long serverTimeMillis;

    /** Number of questions in this match's challenge (the questions themselves carry no answers). */
    private Integer totalQuestions;
    /**
     * Progress of the requesting user only (null in broadcasts and for non-participants):
     * lets a reconnecting client resume at the right question using server truth.
     */
    private Integer viewerAnsweredCount;
    private Integer viewerCorrectCount;
}
