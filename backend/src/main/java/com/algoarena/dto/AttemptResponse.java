package com.algoarena.dto;

import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AttemptResponse {
    private Boolean isCorrect;
    private String correctAnswer;
    private String explanation;
    private Integer xpEarned;
    private Integer coinsEarned;
    private UserDto user; // Updated user progression stats
}
