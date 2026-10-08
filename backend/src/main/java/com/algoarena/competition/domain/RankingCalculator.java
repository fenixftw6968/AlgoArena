package com.algoarena.competition.domain;

import java.time.Duration;
import java.time.Instant;
import java.util.Comparator;
import java.util.List;

/**
 * Deterministic leaderboard ordering:
 * <ol>
 *   <li>higher score</li>
 *   <li>more correct answers</li>
 *   <li>faster completion time (a player who never finished counts as the full duration)</li>
 *   <li>earlier last-submission timestamp (no submission sorts last)</li>
 *   <li>lower participant id - only to make the order total when two timestamps are identical</li>
 * </ol>
 */
public final class RankingCalculator {

    private RankingCalculator() {
    }

    public record Entry(long participantId, int score, int correctCount, long completionMs, Instant lastSubmissionAt) {
    }

    private static final Comparator<Entry> ORDER = Comparator
            .comparingInt(Entry::score).reversed()
            .thenComparing(Comparator.comparingInt(Entry::correctCount).reversed())
            .thenComparingLong(Entry::completionMs)
            .thenComparing(Entry::lastSubmissionAt, Comparator.nullsLast(Comparator.naturalOrder()))
            .thenComparingLong(Entry::participantId);

    /** Returns the entries best-first; position i (0-based) has rank i + 1. */
    public static List<Entry> rank(List<Entry> entries) {
        return entries.stream().sorted(ORDER).toList();
    }

    /**
     * Time taken to complete: from the start to the moment the player finished (their last answer or Finish),
     * clamped to [0, duration]; the full duration if they never finished.
     */
    public static long completionMs(Instant startTime, Instant finishedAt, long durationMs) {
        if (finishedAt == null || startTime == null) {
            return durationMs;
        }
        long elapsed = Duration.between(startTime, finishedAt).toMillis();
        return Math.max(0, Math.min(elapsed, durationMs));
    }
}
