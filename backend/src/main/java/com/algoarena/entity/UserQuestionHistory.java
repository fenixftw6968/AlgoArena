package com.algoarena.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "user_question_history", indexes = {
    @Index(name = "idx_uqh_user_game_diff", columnList = "user_id, game_slug, difficulty")
}, uniqueConstraints = {
    @UniqueConstraint(name = "uq_user_game_diff_q", columnNames = {"user_id", "game_slug", "difficulty", "question_id"})
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UserQuestionHistory {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(name = "game_slug", nullable = false, length = 60)
    private String gameSlug;

    @Column(nullable = false, length = 20)
    private String difficulty;

    @Column(name = "question_id", nullable = false, length = 100)
    private String questionId;

    @CreationTimestamp
    @Column(name = "played_at", nullable = false, updatable = false)
    private LocalDateTime playedAt;
}
