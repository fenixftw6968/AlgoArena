package com.algoarena.dto;

import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PuzzleDto {
    private Long id;
    private String title;
    private String difficulty;
    // JSON string with what the player needs to see (type, grid, choices, statement, question, ...).
    // Answer-bearing keys are stripped by AnswerRedactor. This DTO must never carry the correct answer
    // or explanation: those are only revealed after grading (see AttemptResponse).
    private String content;
    private Integer xpReward;
    private Integer orderIndex;
}
