package com.algoarena.competition.repository;

import com.algoarena.competition.domain.CompetitionSubmission;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface CompetitionSubmissionRepository extends JpaRepository<CompetitionSubmission, Long> {

    Optional<CompetitionSubmission> findByParticipantIdAndQuestionNumber(Long participantId, int questionNumber);

    List<CompetitionSubmission> findByParticipantIdOrderByQuestionNumberAsc(Long participantId);

    long countByCompetitionId(Long competitionId);
}
