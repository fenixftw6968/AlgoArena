package com.algoarena.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "achievements")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Achievement {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 50)
    private String achievementKey;  // e.g. "first-steps"

    @Column(nullable = false, length = 100)
    private String title;

    @Column(nullable = false, length = 300)
    private String description;

    @Column(nullable = false, length = 10)
    private String emoji;

    // Requirement: type and value
    @Column(nullable = false, length = 40)
    private String requirementType;   // e.g. "games_completed"

    @Column(nullable = false)
    private Integer requirementValue; // e.g. 1

    @Column(nullable = false)
    @Builder.Default
    private Integer xpReward = 0;

    @Column(nullable = false, length = 20)
    @Builder.Default
    private String rarity = "COMMON";

    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;
}
