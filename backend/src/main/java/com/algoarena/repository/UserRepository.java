package com.algoarena.repository;

import com.algoarena.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
    
@Repository
public interface UserRepository extends JpaRepository<User, Long> {

    Optional<User> findByEmail(String email);

    Optional<User> findByUsername(String username);

    boolean existsByEmail(String email);

    boolean existsByUsername(String username);

    @Query("SELECT u FROM User u ORDER BY u.xp DESC")
    List<User> findAllOrderByXpDesc();

    @Query("SELECT u FROM User u ORDER BY u.gamesCompleted DESC")
    List<User> findAllOrderByGamesCompletedDesc();

    @Query("SELECT u FROM User u ORDER BY u.currentStreak DESC")
    List<User> findAllOrderByStreakDesc();

    @Query("SELECT u FROM User u ORDER BY u.competitiveRating DESC")
    List<User> findAllOrderByCompetitiveRatingDesc();
}
