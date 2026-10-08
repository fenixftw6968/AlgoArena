package com.algoarena.competition.domain;

import com.algoarena.exception.ConflictException;

import java.util.EnumMap;
import java.util.EnumSet;
import java.util.Map;
import java.util.Set;

/**
 * The single source of truth for what is allowed in each {@link CompetitionStatus}. Pure and side-effect
 * free, so every rule is unit-tested exhaustively.
 *
 * <pre>
 *   LOBBY ---> STARTING ---> RUNNING ---> FINISHED
 *     |           |
 *     +-----------+--------> CANCELLED
 * </pre>
 *
 * Deliberately illegal: any move out of FINISHED/CANCELLED, STARTING to LOBBY (a countdown is never reverted),
 * LOBBY to RUNNING (must pass through STARTING, where the questions are frozen), RUNNING to CANCELLED.
 */
public final class CompetitionStateMachine {

    private static final Map<CompetitionStatus, Set<CompetitionStatus>> TRANSITIONS = new EnumMap<>(CompetitionStatus.class);

    static {
        TRANSITIONS.put(CompetitionStatus.LOBBY, EnumSet.of(CompetitionStatus.STARTING, CompetitionStatus.CANCELLED));
        TRANSITIONS.put(CompetitionStatus.STARTING, EnumSet.of(CompetitionStatus.RUNNING, CompetitionStatus.CANCELLED));
        TRANSITIONS.put(CompetitionStatus.RUNNING, EnumSet.of(CompetitionStatus.FINISHED));
        TRANSITIONS.put(CompetitionStatus.FINISHED, EnumSet.noneOf(CompetitionStatus.class));
        TRANSITIONS.put(CompetitionStatus.CANCELLED, EnumSet.noneOf(CompetitionStatus.class));
    }

    private CompetitionStateMachine() {
    }

    public static boolean canTransition(CompetitionStatus from, CompetitionStatus to) {
        return TRANSITIONS.get(from).contains(to);
    }

    /** @throws ConflictException (HTTP 409) if the move is not allowed */
    public static void requireTransition(CompetitionStatus from, CompetitionStatus to) {
        if (!canTransition(from, to)) {
            throw new ConflictException("Illegal competition state change: " + from + " -> " + to);
        }
    }

    public static boolean isTerminal(CompetitionStatus status) {
        return TRANSITIONS.get(status).isEmpty();
    }

    /** Live competitions occupy their participants' single competition slot. */
    public static boolean isLive(CompetitionStatus status) {
        return !isTerminal(status);
    }

    /** New players may join only while the lobby is open (the roster freezes when the countdown starts). */
    public static boolean canJoin(CompetitionStatus status) {
        return status == CompetitionStatus.LOBBY;
    }

    /** Leaving is possible in the lobby and during the countdown; once RUNNING a player finishes instead. */
    public static boolean canLeave(CompetitionStatus status) {
        return status == CompetitionStatus.LOBBY || status == CompetitionStatus.STARTING;
    }

    public static boolean canSubmit(CompetitionStatus status) {
        return status == CompetitionStatus.RUNNING;
    }

    public static boolean canViewQuestions(CompetitionStatus status) {
        return status == CompetitionStatus.RUNNING;
    }

    public static boolean canViewResults(CompetitionStatus status) {
        return status == CompetitionStatus.FINISHED;
    }
}
