package com.algoarena.competition.domain;

import com.algoarena.competition.domain.RankingCalculator.Entry;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Random;

import static org.junit.jupiter.api.Assertions.*;

class RankingCalculatorTest {

    private static final Instant START = Instant.parse("2026-01-01T10:00:00Z");
    private static final long DURATION = 20 * 60 * 1000L;

    private static Entry e(long id, int score, int correct, long completionMs, int lastSubmissionSecond) {
        return new Entry(id, score, correct, completionMs, lastSubmissionSecond < 0 ? null : START.plusSeconds(lastSubmissionSecond));
    }

    private static List<Long> order(List<Entry> in) {
        return RankingCalculator.rank(in).stream().map(Entry::participantId).toList();
    }

    @Test
    void higherScoreWinsRegardlessOfSpeed() {
        assertEquals(List.of(2L, 1L), order(List.of(e(1, 500, 5, 60_000, 60), e(2, 600, 6, 900_000, 900))));
    }

    @Test
    void equalScoreIsDecidedByCorrectAnswerCount() {
        // artificial (scoring is flat today) but the rule is part of the contract
        assertEquals(List.of(2L, 1L), order(List.of(e(1, 500, 4, 60_000, 60), e(2, 500, 5, 900_000, 900))));
    }

    @Test
    void equalScoreAndCorrectCountIsDecidedByFasterCompletion() {
        assertEquals(List.of(2L, 1L), order(List.of(e(1, 700, 7, 840_000, 840), e(2, 700, 7, 540_000, 540))));
    }

    @Test
    void equalCompletionIsDecidedByEarlierLastSubmission() {
        assertEquals(List.of(2L, 1L), order(List.of(e(1, 300, 3, DURATION, 700), e(2, 300, 3, DURATION, 400))));
    }

    @Test
    void aPlayerWithNoSubmissionSortsLastAmongOtherwiseEqualPlayers() {
        assertEquals(List.of(2L, 3L, 1L), order(List.of(e(1, 0, 0, DURATION, -1), e(2, 0, 0, DURATION, 100), e(3, 0, 0, DURATION, 200))));
    }

    @Test
    void identicalEverythingFallsBackToTheLowerParticipantIdSoTheOrderIsTotal() {
        assertEquals(List.of(3L, 5L, 9L), order(List.of(e(9, 100, 1, 1000, 10), e(3, 100, 1, 1000, 10), e(5, 100, 1, 1000, 10))));
    }

    @Test
    void anyInputOrderProducesTheSameLeaderboard() {
        List<Entry> base = List.of(
                e(1, 900, 9, 700_000, 700), e(2, 900, 9, 650_000, 650), e(3, 800, 8, 300_000, 300), e(4, 800, 8, 300_000, 290),
                e(5, 0, 0, DURATION, -1), e(6, 500, 5, DURATION, 1100), e(7, 500, 5, DURATION, 1100), e(8, 100, 1, 12_000, 12));
        List<Long> expected = order(base);
        Random random = new Random(7);
        for (int i = 0; i < 200; i++) {
            List<Entry> shuffled = new ArrayList<>(base);
            Collections.shuffle(shuffled, random);
            assertEquals(expected, order(shuffled));
        }
        assertEquals(List.of(2L, 1L, 4L, 3L, 6L, 7L, 8L, 5L), expected);
    }

    @Test
    void completionTimeIsTheFinishTimeClampedAndFullDurationIfNeverFinished() {
        assertEquals(DURATION, RankingCalculator.completionMs(START, null, DURATION));
        assertEquals(120_000, RankingCalculator.completionMs(START, START.plusSeconds(120), DURATION));
        assertEquals(0, RankingCalculator.completionMs(START, START.minusSeconds(5), DURATION), "never negative");
        assertEquals(DURATION, RankingCalculator.completionMs(START, START.plusSeconds(99_999), DURATION), "never above the duration");
    }
}
