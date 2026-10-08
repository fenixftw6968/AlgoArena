package com.algoarena.competition.domain;

import com.algoarena.entity.User;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

/** A user's membership in a competition plus their live tallies and (after the end) their final rank. */
@Entity
@Table(name = "competition_participants")
@Getter
@Setter
@NoArgsConstructor
public class CompetitionParticipant {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long competitionId;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private ParticipantStatus status = ParticipantStatus.JOINED;

    /** True while the user occupies their single "live competition" slot (a partial unique index enforces it). */
    @Column(nullable = false)
    private boolean active = true;

    @Column(nullable = false)
    private Instant joinedAt;

    private Instant leftAt;
    private Instant disconnectedAt;

    @Column(nullable = false)
    private int answeredCount;

    @Column(nullable = false)
    private int correctCount;

    @Column(nullable = false)
    private int score;

    private Instant lastSubmissionAt;
    private Instant finishedAt;
    private Integer finalRank;
    private Long finalCompletionMs;
}
