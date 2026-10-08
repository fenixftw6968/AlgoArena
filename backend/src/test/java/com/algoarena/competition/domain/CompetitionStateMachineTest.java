package com.algoarena.competition.domain;

import com.algoarena.exception.ConflictException;
import org.junit.jupiter.api.Test;

import java.util.EnumSet;
import java.util.Set;

import static com.algoarena.competition.domain.CompetitionStatus.*;
import static org.junit.jupiter.api.Assertions.*;

/** Every cell of the transition table, plus the per-state permissions. */
class CompetitionStateMachineTest {

    private static final Set<String> LEGAL = Set.of(
            "LOBBY>STARTING", "LOBBY>CANCELLED",
            "STARTING>RUNNING", "STARTING>CANCELLED",
            "RUNNING>FINISHED");

    @Test
    void exactlyTheDocumentedTransitionsAreLegal() {
        for (CompetitionStatus from : CompetitionStatus.values()) {
            for (CompetitionStatus to : CompetitionStatus.values()) {
                boolean expected = LEGAL.contains(from + ">" + to);
                assertEquals(expected, CompetitionStateMachine.canTransition(from, to), from + " -> " + to);
            }
        }
    }

    @Test
    void illegalTransitionsRaiseAConflict() {
        assertThrows(ConflictException.class, () -> CompetitionStateMachine.requireTransition(FINISHED, RUNNING));
        assertThrows(ConflictException.class, () -> CompetitionStateMachine.requireTransition(CANCELLED, LOBBY));
        assertThrows(ConflictException.class, () -> CompetitionStateMachine.requireTransition(STARTING, LOBBY));
        assertThrows(ConflictException.class, () -> CompetitionStateMachine.requireTransition(LOBBY, RUNNING));
        assertThrows(ConflictException.class, () -> CompetitionStateMachine.requireTransition(RUNNING, CANCELLED));
        assertDoesNotThrow(() -> CompetitionStateMachine.requireTransition(RUNNING, FINISHED));
    }

    @Test
    void terminalStatesHaveNoWayOut() {
        for (CompetitionStatus terminal : EnumSet.of(FINISHED, CANCELLED)) {
            assertTrue(CompetitionStateMachine.isTerminal(terminal));
            assertFalse(CompetitionStateMachine.isLive(terminal));
            for (CompetitionStatus to : CompetitionStatus.values()) {
                assertFalse(CompetitionStateMachine.canTransition(terminal, to), terminal + " -> " + to);
            }
        }
        for (CompetitionStatus live : EnumSet.of(LOBBY, STARTING, RUNNING)) {
            assertTrue(CompetitionStateMachine.isLive(live));
        }
    }

    @Test
    void joiningIsOnlyPossibleInTheLobby() {
        for (CompetitionStatus s : CompetitionStatus.values()) {
            assertEquals(s == LOBBY, CompetitionStateMachine.canJoin(s), s.name());
        }
    }

    @Test
    void leavingIsPossibleInTheLobbyAndDuringTheCountdownOnly() {
        for (CompetitionStatus s : CompetitionStatus.values()) {
            assertEquals(s == LOBBY || s == STARTING, CompetitionStateMachine.canLeave(s), s.name());
        }
    }

    @Test
    void answersAndQuestionsAreOnlyAvailableWhileRunning() {
        for (CompetitionStatus s : CompetitionStatus.values()) {
            assertEquals(s == RUNNING, CompetitionStateMachine.canSubmit(s), s.name());
            assertEquals(s == RUNNING, CompetitionStateMachine.canViewQuestions(s), s.name());
        }
    }

    @Test
    void finalResultsAreOnlyVisibleOnceFinished() {
        for (CompetitionStatus s : CompetitionStatus.values()) {
            assertEquals(s == FINISHED, CompetitionStateMachine.canViewResults(s), s.name());
        }
    }
}
