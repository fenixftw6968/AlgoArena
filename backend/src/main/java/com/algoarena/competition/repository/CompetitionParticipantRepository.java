package com.algoarena.competition.repository;

import com.algoarena.competition.domain.CompetitionParticipant;
import com.algoarena.competition.domain.CompetitionStatus;
import com.algoarena.competition.domain.ParticipantStatus;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface CompetitionParticipantRepository extends JpaRepository<CompetitionParticipant, Long> {

    Optional<CompetitionParticipant> findByCompetitionIdAndUserId(Long competitionId, Long userId);

    /** Row-locks one participant. Submissions and Finish serialise per participant on this lock. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT p FROM CompetitionParticipant p WHERE p.competitionId = :cid AND p.user.id = :uid")
    Optional<CompetitionParticipant> findForUpdate(@Param("cid") Long competitionId, @Param("uid") Long userId);

    /** Row-locks every non-left participant in id order (used by finalisation; waits for in-flight submissions). */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT p FROM CompetitionParticipant p WHERE p.competitionId = :cid AND p.status <> :left ORDER BY p.id")
    List<CompetitionParticipant> findAllMembersForUpdate(@Param("cid") Long competitionId, @Param("left") ParticipantStatus left);

    /** Roster in join order, with the user loaded (usernames/levels only are ever exposed). */
    @Query("SELECT p FROM CompetitionParticipant p JOIN FETCH p.user "
            + "WHERE p.competitionId = :cid AND p.status <> :left ORDER BY p.joinedAt ASC, p.id ASC")
    List<CompetitionParticipant> findRoster(@Param("cid") Long competitionId, @Param("left") ParticipantStatus left);

    default List<CompetitionParticipant> roster(Long competitionId) {
        return findRoster(competitionId, ParticipantStatus.LEFT);
    }

    @Query("SELECT p FROM CompetitionParticipant p JOIN FETCH p.user "
            + "WHERE p.competitionId = :cid AND p.status <> :left ORDER BY p.finalRank ASC, p.id ASC")
    List<CompetitionParticipant> findRanked(@Param("cid") Long competitionId, @Param("left") ParticipantStatus left);

    default List<CompetitionParticipant> ranked(Long competitionId) {
        return findRanked(competitionId, ParticipantStatus.LEFT);
    }

    /** Used by the WebSocket interceptor: is this user a (non-left) member of the competition? */
    @Query("SELECT COUNT(p) > 0 FROM CompetitionParticipant p "
            + "WHERE p.competitionId = :cid AND p.user.id = :uid AND p.status <> :left")
    boolean isMember(@Param("cid") Long competitionId, @Param("uid") Long userId, @Param("left") ParticipantStatus left);

    default boolean isMember(Long competitionId, Long userId) {
        return isMember(competitionId, userId, ParticipantStatus.LEFT);
    }

    /** Number of members who have not finished yet. */
    @Query("SELECT COUNT(p) FROM CompetitionParticipant p WHERE p.competitionId = :cid AND p.status = :joined")
    long countUnfinished(@Param("cid") Long competitionId, @Param("joined") ParticipantStatus joined);

    default long countUnfinished(Long competitionId) {
        return countUnfinished(competitionId, ParticipantStatus.JOINED);
    }

    @Query("SELECT COUNT(p) FROM CompetitionParticipant p WHERE p.competitionId = :cid AND p.status = :finished")
    long countFinished(@Param("cid") Long competitionId, @Param("finished") ParticipantStatus finished);

    default long countFinished(Long competitionId) {
        return countFinished(competitionId, ParticipantStatus.FINISHED);
    }

    /** Competitions in which this user currently occupies the single live slot. */
    @Query("SELECT p FROM CompetitionParticipant p WHERE p.user.id = :uid AND p.active = true")
    List<CompetitionParticipant> findActiveByUserId(@Param("uid") Long userId);

    // ------------------------------------------------------------------ presence (informational + lobby clean-up)

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("UPDATE CompetitionParticipant p SET p.disconnectedAt = :at "
            + "WHERE p.user.id = :uid AND p.active = true AND p.disconnectedAt IS NULL "
            + "AND p.competitionId IN (SELECT c.id FROM Competition c WHERE c.status IN :states)")
    int markDisconnected(@Param("uid") Long userId, @Param("at") Instant at, @Param("states") Collection<CompetitionStatus> states);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("UPDATE CompetitionParticipant p SET p.disconnectedAt = NULL "
            + "WHERE p.user.id = :uid AND p.disconnectedAt IS NOT NULL")
    int clearDisconnected(@Param("uid") Long userId);

    /** Lobby/countdown members whose last connection dropped before {@code cutoff}. */
    @Query("SELECT p FROM CompetitionParticipant p JOIN FETCH p.user "
            + "WHERE p.disconnectedAt IS NOT NULL AND p.disconnectedAt <= :cutoff AND p.active = true "
            + "AND p.status = :joined AND p.competitionId IN (SELECT c.id FROM Competition c WHERE c.status IN :states)")
    List<CompetitionParticipant> findStaleDisconnected(@Param("cutoff") Instant cutoff,
                                                       @Param("joined") ParticipantStatus joined,
                                                       @Param("states") Collection<CompetitionStatus> states);

    /** At start-up every lobby/countdown member gets a fresh grace period (their sockets died with the old process). */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("UPDATE CompetitionParticipant p SET p.disconnectedAt = :at WHERE p.active = true AND p.status = :joined "
            + "AND p.disconnectedAt IS NULL AND p.competitionId IN (SELECT c.id FROM Competition c WHERE c.status IN :states)")
    int markAllLobbyMembersDisconnected(@Param("at") Instant at, @Param("joined") ParticipantStatus joined,
                                        @Param("states") Collection<CompetitionStatus> states);
}
