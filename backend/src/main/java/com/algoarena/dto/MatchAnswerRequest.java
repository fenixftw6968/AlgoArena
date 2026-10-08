package com.algoarena.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** One answer to one question of a match. The server grades it; nothing else is trusted. */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class MatchAnswerRequest {

    @NotNull(message = "questionIndex is required")
    @Min(value = 0, message = "questionIndex must be >= 0")
    @Max(value = 100, message = "questionIndex is out of range")
    private Integer questionIndex;

    /** The chosen option text / typed answer. Null or blank means "no answer" (e.g. timeout) and is graded wrong. */
    @Size(max = 200, message = "answer is too long")
    private String answer;
}
