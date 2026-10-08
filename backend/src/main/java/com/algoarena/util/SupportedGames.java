package com.algoarena.util;

import com.algoarena.exception.BadRequestException;

import java.util.List;
import java.util.Locale;
import java.util.Set;

/**
 * The ONE place that defines which games exist in AlgoArena. Every API that takes a game slug
 * (catalog, puzzles, attempts, matches, question history) validates against this list, so an
 * unknown or retired game can never be queued, played or written to the database.
 */
public final class SupportedGames {

    public static final String DSA_MASTER_QUIZ = "dsa-master-quiz";
    public static final String LOGIC_PUZZLE = "logic-puzzle";
    public static final String NUMBER_DETECTIVE = "number-detective";
    public static final String CODE_BREAKER = "code-breaker";

    /** The approved games, in display order. */
    public static final List<String> SLUGS = List.of(DSA_MASTER_QUIZ, LOGIC_PUZZLE, NUMBER_DETECTIVE, CODE_BREAKER);

    private static final Set<String> LOOKUP = Set.copyOf(SLUGS);

    private SupportedGames() {
    }

    /** True if {@code slug} (case/whitespace-insensitive) is one of the approved games. */
    public static boolean isSupported(String slug) {
        return slug != null && LOOKUP.contains(normalise(slug));
    }

    /** Returns the canonical slug or throws 400 "Unsupported game". */
    public static String require(String slug) {
        if (!isSupported(slug)) {
            throw new BadRequestException("Unsupported game");
        }
        return normalise(slug);
    }

    private static String normalise(String slug) {
        return slug.trim().toLowerCase(Locale.ROOT);
    }
}
