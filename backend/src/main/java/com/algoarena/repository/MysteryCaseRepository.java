package com.algoarena.repository;

import com.algoarena.entity.MysteryCase;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface MysteryCaseRepository extends JpaRepository<MysteryCase, Long> {
    List<MysteryCase> findByIsUnlockedTrue();
}
