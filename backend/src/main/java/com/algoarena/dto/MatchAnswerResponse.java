package com.algoarena.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Result of grading one answer. The correct answer and explanation of THIS question are revealed
 * only now, after the server has recorded the answer.
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class MatchAnswerResponse {
    private boolean correct;
    private String correctAnswer;
    private String explanation;
    private int questionIndex;
    private int answeredCount;
    private int totalQuestions;
    /** True when this was a replay of an already-recorded answer (the first answer stands). */
    private boolean alreadyAnswered;
    /** True once the requesting player has answered every question. */
    private boolean finished;
    /** Current client-safe match state (final result when the match is FINISHED). */
    private MatchDto match;
}
