package com.algoarena.competition.domain;

public enum ParticipantStatus {
    /** In the competition and still able to answer. */
    JOINED,
    /** Answered every question or pressed Finish. */
    FINISHED,
    /** Left the lobby/countdown. Excluded from the roster and the leaderboard. */
    LEFT
}
