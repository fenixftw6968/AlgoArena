package com.algoarena.repository;

import com.algoarena.entity.Friendship;
import com.algoarena.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface FriendshipRepository extends JpaRepository<Friendship, Long> {

    @Query("SELECT f FROM Friendship f WHERE (f.user = :u1 AND f.friend = :u2) OR (f.user = :u2 AND f.friend = :u1)")
    Optional<Friendship> findBetweenUsers(@Param("u1") User u1, @Param("u2") User u2);

    @Query("SELECT f FROM Friendship f WHERE (f.user = :user OR f.friend = :user) AND f.status = :status")
    List<Friendship> findByUserAndStatus(@Param("user") User user, @Param("status") Friendship.Status status);

    @Query("SELECT f FROM Friendship f WHERE f.friend = :user AND f.status = 'PENDING'")
    List<Friendship> findIncomingPendingRequests(@Param("user") User user);

    @Query("SELECT f FROM Friendship f WHERE f.user = :user AND f.status = 'PENDING'")
    List<Friendship> findOutgoingPendingRequests(@Param("user") User user);
}
