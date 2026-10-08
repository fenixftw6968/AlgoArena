package com.algoarena.competition.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

/**
 * One DSA competition. All lobby/state mutations happen while holding a row lock on this entity
 * ({@code CompetitionRepository#findByIdForUpdate}); {@code version} is bumped on every change visible to
 * clients so events can be ordered.
 */
@Entity
@Table(name = "competitions")
@Getter
@Setter
@NoArgsConstructor
public class Competition {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 12)
    private CompetitionStatus status = CompetitionStatus.LOBBY;

    @Column(nullable = false, length = 60)
    private String gameSlug = "dsa-master-quiz";

    @Column(nullable = false)
    private Long createdBy;

    /** Current host: the creator, or the earliest remaining participant if the creator left. */
    @Column(nullable = false)
    private Long hostId;

    @Column(nullable = false)
    private int minPlayers;

    @Column(nullable = false)
    private int maxPlayers;

    @Column(nullable = false)
    private int questionCount;

    @Column(nullable = false)
    private int durationSeconds;

    @Column(nullable = false)
    private int countdownSeconds;

    @Column(nullable = false)
    private int playerCount;

    private Long questionSeed;

    @Column(nullable = false)
    private long version;

    @Column(nullable = false)
    private Instant createdAt;

    @Column(nullable = false)
    private Instant lobbyDeadlineAt;

    private Instant startTime;
    private Instant endTime;
    private Instant finishedAt;

    @Column(length = 40)
    private String cancelledReason;

    private Integer participantCountAtStart;

    public boolean isFull() {
        return playerCount >= maxPlayers;
    }

    public void bumpVersion() {
        version++;
    }
}
