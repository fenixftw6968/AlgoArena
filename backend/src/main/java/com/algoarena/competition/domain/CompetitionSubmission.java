package com.algoarena.competition.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

/** The one official answer of a participant to a question. Unique per (participant, question) in the database. */
@Entity
@Table(name = "competition_submissions")
@Getter
@Setter
@NoArgsConstructor
public class CompetitionSubmission {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long competitionId;

    @Column(nullable = false)
    private Long participantId;

    @Column(nullable = false)
    private int questionNumber;

    @Column(nullable = false)
    private int selectedIndex;

    @Column(name = "is_correct", nullable = false)
    private boolean correct;

    @Column(nullable = false)
    private int scoreAwarded;

    /** Always the SERVER receive time - never a client-supplied value. */
    @Column(nullable = false)
    private Instant submittedAt;
}
