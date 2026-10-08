package com.algoarena.competition.question;

import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Random;

/**
 * Picks the questions of one competition. Pure and deterministic for a given seed (the seed is stored on the
 * competition for audit), so it is fully unit-testable.
 *
 * <ul>
 *   <li>difficulty mix (default 3 easy / 4 medium / 3 hard), questions ordered easy to hard;</li>
 *   <li>at most {@code maxPerCategory} questions per category when the bank allows it;</li>
 *   <li>all questions distinct;</li>
 *   <li>the options of each question are <b>shuffled with the seeded RNG</b> and the correct index is computed
 *       from the shuffled order. This matters: the bank stores the correct answer FIRST in every question.</li>
 * </ul>
 */
public final class QuestionSelector {

    private static final String[] ORDER = {"EASY", "MEDIUM", "HARD"};

    private QuestionSelector() {
    }

    public static List<SnapshotQuestion> select(List<BankQuestion> bank, int[] mix, int count, int maxPerCategory, long seed) {
        if (bank.size() < count) {
            throw new IllegalStateException("Question bank has fewer than " + count + " questions");
        }
        Random random = new Random(seed);
        int[] perDifficulty = scale(mix, count);

        Map<String, Integer> categoryUse = new HashMap<>();
        List<BankQuestion> chosen = new ArrayList<>();
        List<BankQuestion> leftovers = new ArrayList<>();

        for (int d = 0; d < ORDER.length; d++) {
            List<BankQuestion> pool = new ArrayList<>();
            for (BankQuestion q : bank) {
                if (ORDER[d].equals(q.difficulty())) {
                    pool.add(q);
                }
            }
            Collections.shuffle(pool, random);
            int taken = 0;
            for (BankQuestion q : pool) {
                if (taken >= perDifficulty[d]) {
                    leftovers.add(q);
                    continue;
                }
                int used = categoryUse.getOrDefault(q.category(), 0);
                if (used < maxPerCategory) {
                    chosen.add(q);
                    categoryUse.merge(q.category(), 1, Integer::sum);
                    taken++;
                } else {
                    leftovers.add(q);
                }
            }
            // category cap could not be honoured for this difficulty: relax it rather than fail
            for (int i = 0; i < leftovers.size() && taken < perDifficulty[d]; i++) {
                BankQuestion q = leftovers.get(i);
                if (ORDER[d].equals(q.difficulty())) {
                    chosen.add(q);
                    leftovers.remove(i--);
                    taken++;
                }
            }
        }
        // bank may lack questions of some difficulty: top up from anything unused, still distinct
        if (chosen.size() < count) {
            List<BankQuestion> rest = new ArrayList<>(bank);
            rest.removeAll(chosen);
            Collections.shuffle(rest, random);
            for (BankQuestion q : rest) {
                if (chosen.size() >= count) {
                    break;
                }
                chosen.add(q);
            }
        }

        List<SnapshotQuestion> out = new ArrayList<>();
        int number = 1;
        for (BankQuestion q : chosen) {
            List<String> options = new ArrayList<>(q.options());
            Collections.shuffle(options, random);
            int correctIndex = -1;
            for (int i = 0; i < options.size(); i++) {
                if (options.get(i).equalsIgnoreCase(q.correctAnswer())) {
                    correctIndex = i;
                    break;
                }
            }
            out.add(new SnapshotQuestion(number++, q.id(), q.category(), q.difficulty(), q.question(),
                    List.copyOf(options), correctIndex, q.explanation()));
        }
        return out;
    }

    /** Turns the configured mix into per-difficulty counts that add up to {@code count}. */
    static int[] scale(int[] mix, int count) {
        int total = 0;
        for (int m : mix) {
            total += Math.max(0, m);
        }
        if (total == count) {
            return new int[]{mix[0], mix[1], mix[2]};
        }
        int[] result = new int[3];
        int assigned = 0;
        for (int i = 0; i < 3; i++) {
            result[i] = total == 0 ? 0 : (int) Math.floor((double) count * Math.max(0, mix[i]) / total);
            assigned += result[i];
        }
        result[1] += count - assigned; // remainder goes to MEDIUM
        return result;
    }

    /** Parses "3,4,3" (easy,medium,hard). */
    public static int[] parseMix(String mix) {
        String[] parts = mix.split(",");
        if (parts.length != 3) {
            throw new IllegalStateException("competition.difficulty-mix must be 'easy,medium,hard' counts, e.g. 3,4,3");
        }
        int[] result = new int[3];
        for (int i = 0; i < 3; i++) {
            result[i] = Integer.parseInt(parts[i].trim());
        }
        return result;
    }
}
