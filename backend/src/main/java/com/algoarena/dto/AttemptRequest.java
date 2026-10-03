package com.algoarena.dto;

import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AttemptRequest {
    private Long puzzleId;
    @com.fasterxml.jackson.annotation.JsonAlias({"answer", "userAnswer"})
    private String userAnswer;
    private Boolean hintUsed;
    private Integer timeTakenSeconds;
}
