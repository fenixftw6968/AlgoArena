package com.algoarena.competition.domain;

/** Lifecycle of a competition. See {@link CompetitionStateMachine} for the legal transitions. */
public enum CompetitionStatus {
    /** Open for joining/leaving; waiting for the host, a full roster, or the lobby deadline. */
    LOBBY,
    /** Roster frozen, questions snapshotted, server-side countdown to {@code startTime} is running. */
    STARTING,
    /** Questions are available and answers are accepted until {@code endTime}. */
    RUNNING,
    /** Final results are computed and immutable. Terminal. */
    FINISHED,
    /** Never started (not enough players / empty). Terminal. */
    CANCELLED
}
