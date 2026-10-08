package com.algoarena.competition;

import com.algoarena.competition.domain.Competition;
import com.algoarena.competition.domain.CompetitionStatus;
import com.algoarena.competition.domain.ParticipantStatus;
import com.algoarena.competition.repository.CompetitionParticipantRepository;
import com.algoarena.competition.repository.CompetitionQuestionRepository;
import com.algoarena.competition.repository.CompetitionRepository;
import com.algoarena.competition.service.CompetitionFacade;
import com.algoarena.competition.service.CompetitionLobbyService;
import com.algoarena.competition.support.AbstractCompetitionDbTest;
import com.algoarena.competition.web.CompetitionDtos.CompetitionStateDto;
import com.algoarena.entity.User;
import com.algoarena.exception.ConflictException;
import com.algoarena.exception.ForbiddenException;
import com.algoarena.exception.ResourceNotFoundException;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataIntegrityViolationException;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.Callable;

import static org.junit.jupiter.api.Assertions.*;

/** Lobby behaviour and - above all - the 25-player guarantee under real concurrency on a real PostgreSQL. */
class CompetitionLobbyIntegrationTest extends AbstractCompetitionDbTest {

    @Autowired CompetitionLobbyService lobby;
    @Autowired CompetitionFacade facade;
    @Autowired CompetitionRepository competitions;
    @Autowired CompetitionParticipantRepository participants;
    @Autowired CompetitionQuestionRepository questions;

    private long memberCount(Long competitionId) {
        return jdbc.queryForObject("SELECT count(*) FROM competition_participants WHERE competition_id = ? AND status <> 'LEFT'", Long.class, competitionId);
    }

    private Competition reload(Long id) {
        return competitions.findById(id).orElseThrow();
    }

    // ================================================================== create / join / leave

    @Test
    void creatingALobbyMakesTheCreatorItsFirstMemberAndHost() {
        User host = newUser("host");

        Competition c = lobby.create(host);

        assertEquals(CompetitionStatus.LOBBY, c.getStatus());
        assertEquals(1, reload(c.getId()).getPlayerCount());
        assertEquals(host.getId(), reload(c.getId()).getHostId());
        assertEquals(25, c.getMaxPlayers());
        assertEquals(2, c.getMinPlayers());
        assertEquals(10, c.getQuestionCount());
        assertEquals(clock.instant().plusSeconds(600), c.getLobbyDeadlineAt());
        assertEquals(1, memberCount(c.getId()));
    }

    @Test
    void aUserCannotCreateASecondLobbyWhileInALiveOne() {
        User host = newUser("host");
        lobby.create(host);

        assertThrows(ConflictException.class, () -> lobby.create(host));
    }

    @Test
    void joiningAddsTheUserAndIsIdempotent() {
        User host = newUser("host");
        User guest = newUser("guest");
        Competition c = lobby.create(host);

        lobby.join(c.getId(), guest);
        lobby.join(c.getId(), guest); // retry

        assertEquals(2, reload(c.getId()).getPlayerCount());
        assertEquals(2, memberCount(c.getId()));
    }

    @Test
    void joiningAnUnknownCompetitionIsNotFound() {
        assertThrows(ResourceNotFoundException.class, () -> lobby.join(987654L, newUser("guest")));
    }

    @Test
    void aUserInAnotherLiveCompetitionCannotJoin() {
        User host1 = newUser("host1");
        User host2 = newUser("host2");
        Competition c1 = lobby.create(host1);
        Competition c2 = lobby.create(host2);

        assertThrows(ConflictException.class, () -> lobby.join(c2.getId(), host1));
        assertEquals(1, reload(c2.getId()).getPlayerCount());
        assertEquals(1, reload(c1.getId()).getPlayerCount());
    }

    @Test
    void leavingFreesTheSlotAndIsIdempotent() {
        User host = newUser("host");
        User guest = newUser("guest");
        Competition c = lobby.create(host);
        lobby.join(c.getId(), guest);

        lobby.leave(c.getId(), guest.getId());
        lobby.leave(c.getId(), guest.getId()); // retry

        assertEquals(1, reload(c.getId()).getPlayerCount());
        assertEquals(1, memberCount(c.getId()));
        // a left user is free to join another competition
        assertDoesNotThrow(() -> lobby.create(guest));
    }

    @Test
    void aUserWhoLeftCanRejoinWhileTheLobbyIsOpen() {
        User host = newUser("host");
        User guest = newUser("guest");
        Competition c = lobby.create(host);
        lobby.join(c.getId(), guest);
        lobby.leave(c.getId(), guest.getId());

        lobby.join(c.getId(), guest);

        assertEquals(2, reload(c.getId()).getPlayerCount());
        assertEquals(ParticipantStatus.JOINED, participants.findByCompetitionIdAndUserId(c.getId(), guest.getId()).orElseThrow().getStatus());
    }

    @Test
    void aNonMemberCannotLeave() {
        Competition c = lobby.create(newUser("host"));

        assertThrows(ForbiddenException.class, () -> lobby.leave(c.getId(), newUser("stranger").getId()));
    }

    @Test
    void whenTheHostLeavesTheEarliestRemainingMemberBecomesHost() {
        User host = newUser("host");
        User second = newUser("second");
        User third = newUser("third");
        Competition c = lobby.create(host);
        lobby.join(c.getId(), second);
        lobby.join(c.getId(), third);

        lobby.leave(c.getId(), host.getId());

        assertEquals(second.getId(), reload(c.getId()).getHostId());
        assertEquals(host.getId(), reload(c.getId()).getCreatedBy(), "the creator stays recorded for audit");
    }

    @Test
    void whenTheLastMemberLeavesTheLobbyIsCancelledAndTheSlotIsReleased() {
        User host = newUser("host");
        Competition c = lobby.create(host);

        lobby.leave(c.getId(), host.getId());

        Competition after = reload(c.getId());
        assertEquals(CompetitionStatus.CANCELLED, after.getStatus());
        assertEquals("EMPTY", after.getCancelledReason());
        assertEquals(0, after.getPlayerCount());
        assertDoesNotThrow(() -> lobby.create(host));
    }

    // ================================================================== start policy (D3, D4)

    @Test
    void theHostCanStartOnlyWithTheMinimumNumberOfPlayers() {
        User host = newUser("host");
        Competition c = lobby.create(host);

        assertThrows(ConflictException.class, () -> lobby.start(c.getId(), host), "one player is below the minimum of two");

        lobby.join(c.getId(), newUser("guest"));
        Competition started = lobby.start(c.getId(), host);

        assertEquals(CompetitionStatus.STARTING, started.getStatus());
        assertEquals(10, questions.countByCompetitionId(c.getId()), "questions are snapshotted when the countdown begins");
        assertEquals(clock.instant().plusSeconds(10), reload(c.getId()).getStartTime());
        assertEquals(clock.instant().plusSeconds(10 + 1200), reload(c.getId()).getEndTime());
        assertEquals(2, reload(c.getId()).getParticipantCountAtStart());
    }

    @Test
    void onlyTheHostCanStartAndOnlyOnce() {
        User host = newUser("host");
        User guest = newUser("guest");
        Competition c = lobby.create(host);
        lobby.join(c.getId(), guest);

        assertThrows(ForbiddenException.class, () -> lobby.start(c.getId(), guest));
        assertThrows(ForbiddenException.class, () -> lobby.start(c.getId(), newUser("stranger")));
        lobby.start(c.getId(), host);
        assertThrows(ConflictException.class, () -> lobby.start(c.getId(), host));
    }

    @Test
    void theRosterIsFrozenOnceTheCountdownBegins() {
        User host = newUser("host");
        Competition c = lobby.create(host);
        lobby.join(c.getId(), newUser("guest"));
        lobby.start(c.getId(), host);

        User late = newUser("late");
        assertThrows(ConflictException.class, () -> lobby.join(c.getId(), late));
        assertEquals(2, reload(c.getId()).getPlayerCount());
        assertEquals(0, participants.findByCompetitionIdAndUserId(c.getId(), late.getId()).stream().count());
    }

    @Test
    void leavingIsStillAllowedDuringTheCountdown() {
        User host = newUser("host");
        User guest = newUser("guest");
        User third = newUser("third");
        Competition c = lobby.create(host);
        lobby.join(c.getId(), guest);
        lobby.join(c.getId(), third);
        lobby.start(c.getId(), host);

        lobby.leave(c.getId(), third.getId());

        assertEquals(2, reload(c.getId()).getPlayerCount());
        assertEquals(CompetitionStatus.STARTING, reload(c.getId()).getStatus());
    }

    @Test
    void aFullLobbyStartsByItselfAndNobodyElseCanGetIn() {
        User host = newUser("host");
        Competition c = lobby.create(host);
        for (User u : newUsers(24)) {
            lobby.join(c.getId(), u);
        }

        Competition full = reload(c.getId());
        assertEquals(25, full.getPlayerCount());
        assertEquals(CompetitionStatus.STARTING, full.getStatus());
        assertEquals(10, questions.countByCompetitionId(c.getId()));
        assertThrows(ConflictException.class, () -> lobby.join(c.getId(), newUser("number26")));
    }

    // ================================================================== CONCURRENCY - the 25 player guarantee

    @Test
    void twentyFiveSimultaneousJoinersAllFitExactly() throws Exception {
        User host = newUser("host");
        Competition c = lobby.create(host);
        List<User> joiners = newUsers(24);

        List<Callable<Competition>> tasks = new ArrayList<>();
        joiners.forEach(u -> tasks.add(() -> lobby.join(c.getId(), u)));
        List<Outcome<Competition>> outcomes = runConcurrently(tasks);

        assertEquals(24, outcomes.stream().filter(Outcome::ok).count(), () -> "errors: " + outcomes.stream().filter(o -> !o.ok()).map(Outcome::error).toList());
        assertEquals(25, reload(c.getId()).getPlayerCount());
        assertEquals(25, memberCount(c.getId()));
        assertEquals(CompetitionStatus.STARTING, reload(c.getId()).getStatus());
    }

    @Test
    void thirtyConcurrentJoinersNeverExceedTwentyFive() throws Exception {
        User host = newUser("host");
        Competition c = lobby.create(host);
        List<User> joiners = newUsers(30);

        List<Callable<Competition>> tasks = new ArrayList<>();
        joiners.forEach(u -> tasks.add(() -> lobby.join(c.getId(), u)));
        List<Outcome<Competition>> outcomes = runConcurrently(tasks);

        long succeeded = outcomes.stream().filter(Outcome::ok).count();
        long rejected = outcomes.stream().filter(o -> o.error() instanceof ConflictException).count();
        assertEquals(24, succeeded, "creator + 24 = 25 seats");
        assertEquals(6, rejected, "the 26th and later joiners get a clean 409");
        assertEquals(30, succeeded + rejected, () -> "unexpected failures: " + outcomes.stream().filter(o -> !o.ok() && !(o.error() instanceof ConflictException)).map(Outcome::error).toList());
        assertEquals(25, reload(c.getId()).getPlayerCount());
        assertEquals(25, memberCount(c.getId()), "the real number of rows, not just the counter");
    }

    @Test
    void whenOneSlotRemainsExactlyOneOfTwoSimultaneousJoinersGetsIt() throws Exception {
        for (int round = 0; round < 15; round++) {
            User host = newUser("host");
            Competition c = lobby.create(host);
            for (User u : newUsers(23)) {
                lobby.join(c.getId(), u);            // 24 members, one seat left
            }
            User a = newUser("racerA");
            User b = newUser("racerB");

            List<Outcome<Competition>> outcomes = runConcurrently(List.of(
                    () -> lobby.join(c.getId(), a), () -> lobby.join(c.getId(), b)));

            assertEquals(1, outcomes.stream().filter(Outcome::ok).count(), "round " + round);
            assertEquals(1, outcomes.stream().filter(o -> o.error() instanceof ConflictException).count(), "round " + round);
            assertEquals(25, memberCount(c.getId()), "round " + round);
            assertEquals(25, reload(c.getId()).getPlayerCount(), "round " + round);
        }
    }

    @Test
    void theSameUserJoiningManyTimesAtOnceIsOnlyAddedOnce() throws Exception {
        Competition c = lobby.create(newUser("host"));
        User guest = newUser("guest");

        List<Callable<Competition>> tasks = new ArrayList<>();
        for (int i = 0; i < 12; i++) {
            tasks.add(() -> lobby.join(c.getId(), guest));
        }
        List<Outcome<Competition>> outcomes = runConcurrently(tasks);

        assertTrue(outcomes.stream().allMatch(Outcome::ok), () -> "errors: " + outcomes.stream().filter(o -> !o.ok()).map(Outcome::error).toList());
        assertEquals(2, memberCount(c.getId()));
        assertEquals(2, reload(c.getId()).getPlayerCount());
        assertEquals(1, jdbc.queryForObject("SELECT count(*) FROM competition_participants WHERE user_id = ?", Long.class, guest.getId()));
    }

    @Test
    void oneUserRacingIntoTwoLobbiesEndsUpInExactlyOne() throws Exception {
        for (int round = 0; round < 10; round++) {
            Competition c1 = lobby.create(newUser("hostA"));
            Competition c2 = lobby.create(newUser("hostB"));
            User racer = newUser("racer");

            List<Outcome<Competition>> outcomes = runConcurrently(List.of(
                    () -> lobby.join(c1.getId(), racer), () -> lobby.join(c2.getId(), racer)));

            assertEquals(1, outcomes.stream().filter(Outcome::ok).count(), "round " + round);
            assertEquals(1, jdbc.queryForObject("SELECT count(*) FROM competition_participants WHERE user_id = ? AND active", Long.class, racer.getId()), "round " + round);
            assertEquals(1, outcomes.stream().filter(o -> o.error() instanceof ConflictException || o.error() instanceof DataIntegrityViolationException).count(), "round " + round);
            // counters stay truthful for both lobbies
            assertEquals(memberCount(c1.getId()), reload(c1.getId()).getPlayerCount());
            assertEquals(memberCount(c2.getId()), reload(c2.getId()).getPlayerCount());
        }
    }

    @Test
    void joinersRacingTheHostStartAreEitherInTheFrozenRosterOrRejected() throws Exception {
        for (int round = 0; round < 10; round++) {
            User host = newUser("host");
            Competition c = lobby.create(host);
            lobby.join(c.getId(), newUser("early"));
            List<User> racers = newUsers(6);

            List<Callable<Object>> tasks = new ArrayList<>();
            tasks.add(() -> lobby.start(c.getId(), host));
            racers.forEach(u -> tasks.add(() -> lobby.join(c.getId(), u)));
            List<Outcome<Object>> outcomes = runConcurrently(tasks);

            assertTrue(outcomes.get(0).ok(), "the start itself must succeed: " + outcomes.get(0).error());
            Competition after = reload(c.getId());
            assertEquals(CompetitionStatus.STARTING, after.getStatus());
            assertEquals(memberCount(c.getId()), after.getPlayerCount(), "round " + round);
            assertEquals(after.getPlayerCount(), after.getParticipantCountAtStart(),
                    "nobody may slip in after the roster was frozen (round " + round + ")");
            long joinedOk = outcomes.stream().skip(1).filter(Outcome::ok).count();
            assertEquals(2 + joinedOk, after.getPlayerCount(), "round " + round);
            assertEquals(10, questions.countByCompetitionId(c.getId()));
        }
    }

    @Test
    void joinsLeavesAndFailuresNeverBreakTheCounter() throws Exception {
        User host = newUser("host");
        Competition c = lobby.create(host);
        List<User> crowd = newUsers(40);

        List<Callable<Object>> tasks = new ArrayList<>();
        for (int i = 0; i < crowd.size(); i++) {
            User u = crowd.get(i);
            tasks.add(() -> {
                lobby.join(c.getId(), u);
                return null;
            });
            if (i % 3 == 0) {
                tasks.add(() -> {
                    lobby.leave(c.getId(), u.getId());
                    return null;
                });
            }
        }
        runConcurrently(tasks);

        Competition after = reload(c.getId());
        assertTrue(after.getPlayerCount() <= 25 && after.getPlayerCount() >= 0);
        assertEquals(memberCount(c.getId()), after.getPlayerCount(), "counter == real rows");
    }

    @Test
    void aMisconfiguredMaximumAboveTwentyFiveIsStoppedByTheDatabase() {
        props.setMaxPlayers(26);

        assertThrows(DataIntegrityViolationException.class, () -> lobby.create(newUser("host")));
    }

    @Test
    void theApplicationRefusesToStartWithANonsensicalMaximum() {
        props.setMaxPlayers(30);
        assertThrows(IllegalStateException.class, props::validate);
        props.setMaxPlayers(25);
        props.setMinPlayers(1);
        assertThrows(IllegalStateException.class, props::validate);
    }

    @Test
    void theFacadeJoinReturnsTheViewerSpecificState() {
        User host = newUser("host");
        User guest = newUser("guest");
        CompetitionStateDto created = facade.create(host);

        CompetitionStateDto joined = facade.join(created.id(), guest);

        assertTrue(joined.member());
        assertEquals(2, joined.playerCount());
        assertEquals(2, joined.players().size());
        assertTrue(joined.players().stream().anyMatch(p -> p.you() && p.username().equals(guest.getUsername())));
        assertTrue(joined.players().stream().anyMatch(p -> p.host() && p.username().equals(host.getUsername())));
        assertFalse(joined.canStart(), "only the host can start");
    }
}
