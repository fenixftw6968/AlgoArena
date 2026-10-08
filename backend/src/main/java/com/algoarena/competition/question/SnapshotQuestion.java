package com.algoarena.competition.question;

import java.util.List;

/** A question frozen for one competition: fixed number, fixed (shuffled) option order, known correct index. */
public record SnapshotQuestion(int number, String sourceId, String category, String difficulty, String text,
                               List<String> options, int correctIndex, String explanation) {
}
