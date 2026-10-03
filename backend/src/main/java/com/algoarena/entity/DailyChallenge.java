package com.algoarena.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "daily_challenges")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DailyChallenge {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 150)
    private String title;

    @Column(nullable = false, length = 400)
    private String description;

    @Column(nullable = false, unique = true)
    private LocalDate challengeDate;

    @Column(nullable = false, length = 30)
    @Builder.Default
    private String type = "dsa-master-quiz";

    @Column(nullable = false, length = 10)
    @Builder.Default
    private String difficulty = "HARD";

    @Column(nullable = false)
    @Builder.Default
    private Integer xpReward = 100;

    @Column(nullable = false)
    @Builder.Default
    private Integer coinReward = 50;

    /**
     * JSONB: The actual puzzle content for the daily challenge
     */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb", nullable = false)
    private String puzzle;

    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;
}
