package com.algoarena.competition.repository;

import com.algoarena.competition.domain.Competition;
import com.algoarena.competition.domain.CompetitionStatus;
import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface CompetitionRepository extends JpaRepository<Competition, Long> {

    /**
     * SELECT ... FOR UPDATE. Every lobby/state mutation (join, leave, start, cancel, finish) takes this lock first,
     * which serialises them per competition and is what guarantees the 25-player cap under concurrency.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT c FROM Competition c WHERE c.id = :id")
    Optional<Competition> findByIdForUpdate(@Param("id") Long id);

    /** A fresh, lightweight read straight from the database (never served from the persistence context). */
    @Query("SELECT c.status AS status, c.startTime AS startTime, c.endTime AS endTime, "
            + "c.lobbyDeadlineAt AS lobbyDeadlineAt, c.questionCount AS questionCount "
            + "FROM Competition c WHERE c.id = :id")
    Optional<StatusView> findStatusView(@Param("id") Long id);

    interface StatusView {
        CompetitionStatus getStatus();

        Instant getStartTime();

        Instant getEndTime();

        Instant getLobbyDeadlineAt();

        Integer getQuestionCount();
    }

    Page<Competition> findByStatusOrderByCreatedAtDesc(CompetitionStatus status, Pageable pageable);

    long countByStatusIn(Collection<CompetitionStatus> statuses);

    /** Ids of competitions whose next lifecycle step is due. */
    @Query("SELECT c.id FROM Competition c WHERE "
            + "(c.status = :lobby AND c.lobbyDeadlineAt <= :now) "
            + "OR (c.status = :starting AND c.startTime <= :now) "
            + "OR (c.status = :running AND c.endTime <= :runningCutoff)")
    List<Long> findDueIds(@Param("now") Instant now,
                          @Param("runningCutoff") Instant runningCutoff,
                          @Param("lobby") CompetitionStatus lobby,
                          @Param("starting") CompetitionStatus starting,
                          @Param("running") CompetitionStatus running);

    default List<Long> findDue(Instant now, Instant runningCutoff) {
        return findDueIds(now, runningCutoff, CompetitionStatus.LOBBY, CompetitionStatus.STARTING, CompetitionStatus.RUNNING);
    }
}
