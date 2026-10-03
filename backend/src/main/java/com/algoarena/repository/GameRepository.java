package com.algoarena.repository;

import com.algoarena.entity.Game;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface GameRepository extends JpaRepository<Game, Long> {
    Optional<Game> findBySlug(String slug);
    List<Game> findByCategory(String category);
    List<Game> findByIsFeaturedTrue();
    List<Game> findByIsUnlockedTrue();
}
