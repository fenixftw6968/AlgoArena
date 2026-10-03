package com.algoarena.repository;

import com.algoarena.entity.Puzzle;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface PuzzleRepository extends JpaRepository<Puzzle, Long> {
    List<Puzzle> findByGameId(Long gameId);
    List<Puzzle> findByGameIdAndDifficulty(Long gameId, String difficulty);
    List<Puzzle> findByGameSlugAndDifficulty(String gameSlug, String difficulty);

    @Query("SELECT p FROM Puzzle p WHERE p.game.slug = :slug AND p.isActive = true ORDER BY RANDOM()")
    List<Puzzle> findRandomByGameSlug(String slug);

    @Query("SELECT p FROM Puzzle p WHERE p.game.slug = :slug AND p.difficulty = :difficulty AND p.isActive = true ORDER BY RANDOM()")
    List<Puzzle> findRandomByGameSlugAndDifficulty(String slug, String difficulty);
}
