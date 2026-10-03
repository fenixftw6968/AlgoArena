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
    private String content; // JSON string containing type, grid, choices, description, statement, question, etc.
    private String correctAnswer; // JSON string containing answer
    private String explanation;
    private Integer xpReward;
    private Integer orderIndex;
}
