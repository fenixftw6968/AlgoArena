package com.algoarena.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "games")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Game {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 60)
    private String slug;

    @Column(nullable = false, length = 100)
    private String title;

    @Column(nullable = false, length = 500)
    private String description;

    @Column(nullable = false, length = 40)
    private String category;

    @Column(nullable = false, length = 10)
    private String icon;

    @Column(nullable = false, length = 10)
    @Builder.Default
    private String difficulty = "MEDIUM";

    @Column(nullable = false)
    @Builder.Default
    private Integer xpRewardEasy = 10;

    @Column(nullable = false)
    @Builder.Default
    private Integer xpRewardMedium = 25;

    @Column(nullable = false)
    @Builder.Default
    private Integer xpRewardHard = 50;

    @Column(nullable = false)
    @Builder.Default
    private Boolean isUnlocked = true;

    @Column(nullable = false)
    @Builder.Default
    private Boolean isNew = false;

    @Column(nullable = false)
    @Builder.Default
    private Boolean isFeatured = false;

    @Column(nullable = false)
    @Builder.Default
    private Integer totalPlayers = 0;

    @Column(nullable = false)
    @Builder.Default
    private Integer completionRate = 0;

    @Column(length = 20)
    private String estimatedTime;

    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @OneToMany(mappedBy = "game", cascade = CascadeType.ALL, fetch = FetchType.LAZY)
    @Builder.Default
    private List<Puzzle> puzzles = new ArrayList<>();
}
