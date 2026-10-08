package com.algoarena.competition.repository;

import com.algoarena.competition.domain.CompetitionQuestion;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface CompetitionQuestionRepository extends JpaRepository<CompetitionQuestion, Long> {

    List<CompetitionQuestion> findByCompetitionIdOrderByQuestionNumberAsc(Long competitionId);

    Optional<CompetitionQuestion> findByCompetitionIdAndQuestionNumber(Long competitionId, int questionNumber);

    long countByCompetitionId(Long competitionId);
}
