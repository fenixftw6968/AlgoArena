package com.algoarena.dto;

import lombok.*;
import java.time.LocalDateTime;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DailyChallengeDto {
    private Long id;
    private String title;
    private String description;
    private String type;
    private String difficulty;
    private Integer xpReward;
    private Integer coinReward;
    private String puzzle; // JSON string representing the puzzle
    private String expiresAt;
    private Boolean completedToday;
    private Boolean isCorrect;
    private Integer xpEarned;
    private Integer coinsEarned;
}
