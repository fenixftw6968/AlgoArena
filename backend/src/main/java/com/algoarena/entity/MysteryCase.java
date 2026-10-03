package com.algoarena.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "mystery_cases")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class MysteryCase {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 150)
    private String title;

    @Column(nullable = false, length = 250)
    private String subtitle;

    @Column(nullable = false, length = 10)
    @Builder.Default
    private String difficulty = "MEDIUM";

    @Column(nullable = false)
    @Builder.Default
    private Integer xpReward = 150;

    @Column(nullable = false)
    @Builder.Default
    private Boolean isUnlocked = true;

    @Column(nullable = false)
    @Builder.Default
    private Boolean isNew = false;

    @Column(length = 10)
    private String coverEmoji;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String synopsis;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String crimeDescription;

    /**
     * JSONB: Array of suspect objects
     * [{ "id": "aman", "name": "Aman Verma", "role": "...", "avatar": "🧑",
     *    "motive": "...", "statement": "...", "suspicious": [...] }]
     */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb", nullable = false)
    private String suspects;

    /**
     * JSONB: Array of evidence objects
     */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb", nullable = false)
    private String evidence;

    /**
     * JSONB: Array of timeline events
     * [{ "time": "7:57 PM", "event": "..." }]
     */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb", nullable = false)
    private String timeline;

    /**
     * JSONB: { "culprit": "aman", "motive": "gambling-debts", "keyEvidence": ["e1","e2"] }
     */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb", nullable = false)
    private String correctAnswer;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String solution;

    /**
     * JSONB: Choice options for culprit/motive selection
     */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    private String culpritChoices;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    private String motiveChoices;

    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;
}
