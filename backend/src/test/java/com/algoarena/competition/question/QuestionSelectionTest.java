package com.algoarena.competition.question;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;

/** The real backend DSA bank, validated, and the seeded selector. */
class QuestionSelectionTest {

    private final CompetitionQuestionSource source = new CompetitionQuestionSource(new ObjectMapper());

    // ------------------------------------------------------------------ the source

    @Test
    void theRealBankLoadsAndValidates() {
        List<BankQuestion> bank = source.all();

        assertEquals(150, bank.size());
        assertEquals(150, bank.stream().map(BankQuestion::id).distinct().count());
        assertTrue(bank.stream().allMatch(q -> q.options().size() == 4));
        assertTrue(bank.stream().allMatch(q -> q.options().stream().anyMatch(o -> o.equalsIgnoreCase(q.correctAnswer()))));
    }

    @Test
    void malformedBanksAreRejectedLoudly() throws Exception {
        ObjectMapper m = new ObjectMapper();
        assertThrows(IllegalStateException.class, () -> source.parse(m.readTree("[]")));
        assertThrows(IllegalStateException.class, () -> source.parse(m.readTree("{}")));
        // answer not among the options
        assertThrows(IllegalStateException.class, () -> source.parse(m.readTree(
                "[{\"id\":\"a\",\"question\":\"q\",\"options\":[\"x\",\"y\"],\"correctAnswer\":\"z\"}]")));
        // duplicate ids
        assertThrows(IllegalStateException.class, () -> source.parse(m.readTree(
                "[{\"id\":\"a\",\"question\":\"q\",\"options\":[\"x\",\"y\"],\"correctAnswer\":\"x\"},"
                        + "{\"id\":\"a\",\"question\":\"q2\",\"options\":[\"x\",\"y\"],\"correctAnswer\":\"x\"}]")));
        // duplicate options
        assertThrows(IllegalStateException.class, () -> source.parse(m.readTree(
                "[{\"id\":\"a\",\"question\":\"q\",\"options\":[\"x\",\"X\"],\"correctAnswer\":\"x\"}]")));
        // too few options
        assertThrows(IllegalStateException.class, () -> source.parse(m.readTree(
                "[{\"id\":\"a\",\"question\":\"q\",\"options\":[\"x\"],\"correctAnswer\":\"x\"}]")));
    }

    // ------------------------------------------------------------------ the selector

    private List<SnapshotQuestion> select(long seed) {
        return QuestionSelector.select(source.all(), new int[]{3, 4, 3}, 10, 2, seed);
    }

    @Test
    void selectsExactlyTenDistinctQuestionsWithTheRequestedDifficultyMixInOrder() {
        List<SnapshotQuestion> qs = select(42L);

        assertEquals(10, qs.size());
        assertEquals(10, qs.stream().map(SnapshotQuestion::sourceId).distinct().count());
        assertEquals(List.of(1, 2, 3, 4, 5, 6, 7, 8, 9, 10), qs.stream().map(SnapshotQuestion::number).toList());
        assertEquals(List.of("EASY", "EASY", "EASY", "MEDIUM", "MEDIUM", "MEDIUM", "MEDIUM", "HARD", "HARD", "HARD"),
                qs.stream().map(SnapshotQuestion::difficulty).toList());
    }

    @Test
    void noCategoryAppearsMoreThanTwice() {
        for (long seed = 0; seed < 100; seed++) {
            Map<String, Integer> perCategory = new HashMap<>();
            select(seed).forEach(q -> perCategory.merge(q.category(), 1, Integer::sum));
            assertTrue(perCategory.values().stream().allMatch(c -> c <= 2), "seed " + seed + " -> " + perCategory);
        }
    }

    @Test
    void theSameSeedAlwaysGivesTheSameSetOrderAndOptionOrder() {
        assertEquals(select(12345L), select(12345L));
    }

    @Test
    void differentSeedsGiveDifferentContests() {
        Set<List<String>> distinctSets = new HashSet<>();
        for (long seed = 0; seed < 30; seed++) {
            distinctSets.add(select(seed).stream().map(SnapshotQuestion::sourceId).toList());
        }
        assertTrue(distinctSets.size() > 20, "selection must actually vary, got " + distinctSets.size());
    }

    @Test
    void correctIndexAlwaysPointsAtTheRealAnswerInTheShuffledOptions() {
        Map<String, BankQuestion> byId = new HashMap<>();
        source.all().forEach(q -> byId.put(q.id(), q));
        for (long seed = 0; seed < 50; seed++) {
            for (SnapshotQuestion q : select(seed)) {
                BankQuestion original = byId.get(q.sourceId());
                assertEquals(original.correctAnswer().toLowerCase(), q.options().get(q.correctIndex()).toLowerCase());
                assertEquals(Set.copyOf(original.options()), Set.copyOf(q.options()), "same options, just reordered");
                assertEquals(4, q.options().size());
            }
        }
    }

    @Test
    void theBanksAnswerIsAlwaysStoredFirstSoShufflingMustSpreadTheCorrectPosition() {
        // The bank puts the correct answer first in every question (verified below). If options were not shuffled,
        // every correct answer would be option A. The snapshot must spread them across all four positions.
        assertTrue(source.all().stream().allMatch(q -> q.options().get(0).equalsIgnoreCase(q.correctAnswer())),
                "premise: the bank stores the correct answer first");

        int[] positions = new int[4];
        for (long seed = 0; seed < 300; seed++) {
            for (SnapshotQuestion q : select(seed)) {
                positions[q.correctIndex()]++;
            }
        }
        int total = positions[0] + positions[1] + positions[2] + positions[3];
        for (int p = 0; p < 4; p++) {
            double share = (double) positions[p] / total;
            assertTrue(share > 0.20 && share < 0.30, "position " + p + " share was " + share);
        }
    }

    @Test
    void mixIsScaledWhenItDoesNotAddUpToTheQuestionCount() {
        assertArrayEquals(new int[]{3, 4, 3}, QuestionSelector.scale(new int[]{3, 4, 3}, 10));
        int[] scaled = QuestionSelector.scale(new int[]{3, 4, 3}, 5);
        assertEquals(5, scaled[0] + scaled[1] + scaled[2]);
        assertEquals(20, QuestionSelector.scale(new int[]{1, 1, 1}, 20)[0] + QuestionSelector.scale(new int[]{1, 1, 1}, 20)[1]
                + QuestionSelector.scale(new int[]{1, 1, 1}, 20)[2]);
        assertArrayEquals(new int[]{3, 4, 3}, QuestionSelector.parseMix(" 3, 4 ,3"));
        assertThrows(IllegalStateException.class, () -> QuestionSelector.parseMix("3,4"));
    }

    @Test
    void aTooSmallBankIsRefused() {
        assertThrows(IllegalStateException.class,
                () -> QuestionSelector.select(source.all().subList(0, 5), new int[]{3, 4, 3}, 10, 2, 1L));
    }
}
