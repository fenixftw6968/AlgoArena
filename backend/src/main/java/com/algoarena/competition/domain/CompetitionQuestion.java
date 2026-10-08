package com.algoarena.competition.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.util.List;

/**
 * Immutable per-competition snapshot of a question. {@code correctIndex} and {@code explanation} are
 * SERVER-ONLY: no client DTO may expose them before the competition is FINISHED (and afterwards only
 * through the participant's own review).
 */
@Entity
@Table(name = "competition_questions")
@Getter
@Setter
@NoArgsConstructor
public class CompetitionQuestion {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long competitionId;

    @Column(nullable = false)
    private int questionNumber;

    @Column(nullable = false, length = 100)
    private String sourceId;

    @Column(length = 60)
    private String category;

    @Column(length = 10)
    private String difficulty;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String questionText;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(nullable = false, columnDefinition = "jsonb")
    private List<String> options;

    @Column(nullable = false)
    private int correctIndex;

    @Column(columnDefinition = "TEXT")
    private String explanation;
}
