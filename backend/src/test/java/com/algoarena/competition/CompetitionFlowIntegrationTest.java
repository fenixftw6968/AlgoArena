package com.algoarena.competition;

import com.algoarena.competition.domain.Competition;
import com.algoarena.competition.domain.CompetitionStatus;
import com.algoarena.competition.repository.CompetitionRepository;
import com.algoarena.competition.service.CompetitionFacade;
import com.algoarena.competition.service.CompetitionLifecycleService;
import com.algoarena.competition.service.CompetitionLobbyService;
import com.algoarena.competition.support.AbstractCompetitionDbTest;
import com.algoarena.competition.web.CompetitionDtos.*;
import com.algoarena.entity.User;
import com.algoarena.exception.BadRequestException;
import com.algoarena.exception.ConflictException;
import com.algoarena.exception.ForbiddenException;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.Callable;

import static org.junit.jupiter.api.Assertions.*;

/** Whole-life tests: lobby -> countdown -> running -> submissions -> finished, with the clock under test control. */
class CompetitionFlowIntegrationTest extends AbstractCompetitionDbTest {

    @Autowired CompetitionLobbyService lobby;
    @Autowired CompetitionLifecycleService lifecycle;
    @Autowired CompetitionFacade facade;
    @Autowired CompetitionRepository competitions;

    private Competition reload(Long id) {
        return competitions.findById(id).orElseThrow();
    }

    private int correctIndex(Long competitionId, int number) {
        return jdbc.queryForObject("SELECT correct_index FROM competition_questions WHERE competition_id = ? AND question_number = ?",
                Integer.class, competitionId, number);
    }

    private int wrongIndex(Long competitionId, int number) {
        return (correctIndex(competitionId, number) + 1) % 4;
    }

    /** Creates a competition with the given users, starts it and moves the clock to the running phase. */
    private Competition runningWith(User host, List<User> others) {
        Competition c = lobby.create(host);
        others.forEach(u -> lobby.join(c.getId(), u));
        if (reload(c.getId()).getStatus() == CompetitionStatus.LOBBY) {   // a full lobby has already auto-started
            lobby.start(c.getId(), host);
        }
        advance(10);
        lifecycle.advance(c.getId());
        assertEquals(CompetitionStatus.RUNNING, reload(c.getId()).getStatus());
        return c;
    }

    // ------------------------------------------------------------------ lifecycle by clock

    @Test
    void theCountdownStartsTheCompetitionAtTheStartTimeAndNotBefore() {
        User host = newUser("host");
        Competition c = lobby.create(host);
        lobby.join(c.getId(), newUser("guest"));
        lobby.start(c.getId(), host);

        advance(9);
        lifecycle.advance(c.getId());
        assertEquals(CompetitionStatus.STARTING, reload(c.getId()).getStatus());

        advance(1);
        lifecycle.advance(c.getId());
        assertEquals(CompetitionStatus.RUNNING, reload(c.getId()).getStatus());
    }

    @Test
    void lobbyDeadlineStartsWithEnoughPlayersAndCancelsWithoutThem() {
        User host = newUser("host");
        Competition enough = lobby.create(host);
        lobby.join(enough.getId(), newUser("guest"));
        Competition alone = lobby.create(newUser("loner"));

        advance(599);
        lifecycle.advance(enough.getId());
        lifecycle.advance(alone.getId());
        assertEquals(CompetitionStatus.LOBBY, reload(enough.getId()).getStatus());

        advance(1);
        lifecycle.advance(enough.getId());
        lifecycle.advance(alone.getId());

        assertEquals(CompetitionStatus.STARTING, reload(enough.getId()).getStatus());
        assertEquals(CompetitionStatus.CANCELLED, reload(alone.getId()).getStatus());
        assertEquals("NOT_ENOUGH_PLAYERS", reload(alone.getId()).getCancelledReason());
    }

    @Test
    void aCancelledCompetitionReleasesItsPlayers() {
        User loner = newUser("loner");
        Competition c = lobby.create(loner);
        advance(600);
        lifecycle.advance(c.getId());

        assertDoesNotThrow(() -> lobby.create(loner));
    }

    @Test
    void ifPlayersLeaveDuringTheCountdownBelowTheMinimumItIsCancelled() {
        User host = newUser("host");
        User guest = newUser("guest");
        Competition c = lobby.create(host);
        lobby.join(c.getId(), guest);
        lobby.start(c.getId(), host);
        lobby.leave(c.getId(), guest.getId());

        advance(10);
        lifecycle.advance(c.getId());

        assertEquals(CompetitionStatus.CANCELLED, reload(c.getId()).getStatus());
    }

    @Test
    void timeRunningOutFinalizesAfterTheDelayAndFreesEveryone() {
        User host = newUser("host");
        User guest = newUser("guest");
        Competition c = runningWith(host, List.of(guest));

        advance(1200);
        lifecycle.advance(c.getId());
        assertEquals(CompetitionStatus.RUNNING, reload(c.getId()).getStatus(), "finalize delay (grace) not yet elapsed");

        clock.advance(java.time.Duration.ofMillis(1500));
        lifecycle.advance(c.getId());

        assertEquals(CompetitionStatus.FINISHED, reload(c.getId()).getStatus());
        assertEquals(2, jdbc.queryForObject("SELECT count(*) FROM competition_participants WHERE competition_id = ? AND final_rank IS NOT NULL", Long.class, c.getId()));
        assertDoesNotThrow(() -> lobby.create(host), "participants are released when it finishes");
    }

    @Test
    void advancingIsIdempotentAndSafeToRepeat() {
        Competition c = runningWith(newUser("host"), List.of(newUser("guest")));
        advance(2000);

        lifecycle.advance(c.getId());
        long version = reload(c.getId()).getVersion();
        lifecycle.advance(c.getId());
        lifecycle.advance(c.getId());

        assertEquals(version, reload(c.getId()).getVersion());
    }

    // ------------------------------------------------------------------ submissions

    @Test
    void correctAnswersScore100AndWrongAnswersScoreZero() {
        User host = newUser("host");
        User guest = newUser("guest");
        Competition c = runningWith(host, List.of(guest));

        SubmissionResultDto right = facade.submit(c.getId(), host, 1, correctIndex(c.getId(), 1));
        SubmissionResultDto wrong = facade.submit(c.getId(), host, 2, wrongIndex(c.getId(), 2));

        assertTrue(right.correct());
        assertEquals(100, right.scoreAwarded());
        assertFalse(wrong.correct());
        assertEquals(0, wrong.scoreAwarded());
        assertEquals(100, wrong.totalScore());
        assertEquals(2, wrong.answeredCount());
    }

    @Test
    void anAnswerIsFinalAndAReplayReturnsTheOriginalVerdictWithoutChangingTheScore() {
        User host = newUser("host");
        Competition c = runningWith(host, List.of(newUser("guest")));
        facade.submit(c.getId(), host, 1, wrongIndex(c.getId(), 1));

        SubmissionResultDto retry = facade.submit(c.getId(), host, 1, correctIndex(c.getId(), 1));

        assertTrue(retry.alreadySubmitted());
        assertFalse(retry.correct(), "changing your mind is not allowed");
        assertEquals(0, retry.totalScore());
        assertEquals(1, jdbc.queryForObject("SELECT count(*) FROM competition_submissions WHERE competition_id = ?", Long.class, c.getId()));
    }

    @Test
    void invalidQuestionOrOptionIsRejectedAndRecordsNothing() {
        User host = newUser("host");
        Competition c = runningWith(host, List.of(newUser("guest")));

        assertThrows(BadRequestException.class, () -> facade.submit(c.getId(), host, 11, 0));
        assertThrows(BadRequestException.class, () -> facade.submit(c.getId(), host, 0, 0));
        assertThrows(BadRequestException.class, () -> facade.submit(c.getId(), host, 1, 4));
        assertThrows(BadRequestException.class, () -> facade.submit(c.getId(), host, 1, -1));

        assertEquals(0, jdbc.queryForObject("SELECT count(*) FROM competition_submissions", Long.class));
    }

    @Test
    void nonParticipantsAndPlayersWhoLeftCannotSubmit() {
        User host = newUser("host");
        User guest = newUser("guest");
        User leaver = newUser("leaver");
        Competition c = lobby.create(host);
        lobby.join(c.getId(), guest);
        lobby.join(c.getId(), leaver);
        lobby.leave(c.getId(), leaver.getId());
        lobby.start(c.getId(), host);
        advance(10);
        lifecycle.advance(c.getId());

        assertThrows(ForbiddenException.class, () -> facade.submit(c.getId(), newUser("stranger"), 1, 0));
        assertThrows(ForbiddenException.class, () -> facade.submit(c.getId(), leaver, 1, 0));
    }

    @Test
    void submittingBeforeTheStartIsRejected() {
        User host = newUser("host");
        Competition c = lobby.create(host);
        lobby.join(c.getId(), newUser("guest"));
        lobby.start(c.getId(), host);

        assertThrows(ConflictException.class, () -> facade.submit(c.getId(), host, 1, 0));
    }

    @Test
    void submittingAfterTheEndTimeIsRejectedEvenIfTheCompetitionIsNotFinalizedYet() {
        User host = newUser("host");
        Competition c = runningWith(host, List.of(newUser("guest")));
        advance(1201); // past end_time, but before the finalize delay ever ran

        assertThrows(ConflictException.class, () -> facade.submit(c.getId(), host, 1, correctIndex(c.getId(), 1)));
        assertEquals(0, jdbc.queryForObject("SELECT count(*) FROM competition_submissions", Long.class));
    }

    @Test
    void answeringAllTenQuestionsFinishesTheParticipantAtTheServerTime() {
        User host = newUser("host");
        User guest = newUser("guest");
        Competition c = runningWith(host, List.of(guest));
        SubmissionResultDto last = null;
        for (int q = 1; q <= 10; q++) {
            advance(5);
            last = facade.submit(c.getId(), host, q, correctIndex(c.getId(), q));
        }

        assertTrue(last.finished());
        assertEquals(1000, last.totalScore());
        assertEquals(50_000L, jdbc.queryForObject("SELECT EXTRACT(EPOCH FROM (finished_at - (SELECT start_time FROM competitions WHERE id = ?))) * 1000 "
                + "FROM competition_participants WHERE competition_id = ? AND user_id = ?", Long.class, c.getId(), c.getId(), host.getId()));
        assertTrue(facade.submit(c.getId(), host, 1, 0).alreadySubmitted(), "a replay after finishing just returns the original verdict");
    }

    @Test
    void finishingEarlyKeepsTheScoreAndIsIdempotent() {
        User host = newUser("host");
        Competition c = runningWith(host, List.of(newUser("guest")));
        facade.submit(c.getId(), host, 1, correctIndex(c.getId(), 1));

        ParticipantResultDto first = facade.finish(c.getId(), host);
        advance(30);
        ParticipantResultDto second = facade.finish(c.getId(), host);

        assertTrue(first.finished());
        assertEquals(100, first.score());
        assertEquals(first.finishedAt(), second.finishedAt(), "the first finish time is kept");
        assertThrows(ConflictException.class, () -> facade.submit(c.getId(), host, 2, 0));
    }

    // ------------------------------------------------------------------ finishing / leaderboard (D2, D5, D6)

    @Test
    void whenEveryoneFinishesTheCompetitionEndsImmediately() {
        User host = newUser("host");
        User guest = newUser("guest");
        Competition c = runningWith(host, List.of(guest));

        facade.finish(c.getId(), host);
        assertEquals(CompetitionStatus.RUNNING, reload(c.getId()).getStatus(), "one player is still going");
        facade.finish(c.getId(), guest);

        assertEquals(CompetitionStatus.FINISHED, reload(c.getId()).getStatus());
    }

    @Test
    void theLeaderboardIsRankedByScoreThenSpeedAndNeverFinishedMeansFullDuration() {
        User fast = newUser("fast");
        User slow = newUser("slow");
        User idle = newUser("idle");
        Competition c = runningWith(fast, List.of(slow, idle));
        advance(10);
        for (int q = 1; q <= 3; q++) {
            facade.submit(c.getId(), fast, q, correctIndex(c.getId(), q));
        }
        advance(10);
        for (int q = 1; q <= 3; q++) {
            facade.submit(c.getId(), slow, q, correctIndex(c.getId(), q));
        }
        facade.finish(c.getId(), fast);
        advance(5);
        facade.finish(c.getId(), slow);
        advance(2000);
        lifecycle.advance(c.getId());

        LeaderboardDto board = facade.leaderboard(c.getId(), fast);

        assertEquals(3, board.entries().size());
        assertEquals(fast.getUsername(), board.entries().get(0).username());
        assertEquals(slow.getUsername(), board.entries().get(1).username());
        assertEquals(idle.getUsername(), board.entries().get(2).username());
        assertEquals(1200_000L, board.entries().get(2).completionTimeMs(), "never finished = the full duration");
        assertEquals(300, board.entries().get(0).score());
        assertTrue(board.you().you());
        assertEquals(1, board.you().rank());
    }

    @Test
    void resultsAreHiddenUntilTheCompetitionIsFinished() {
        User host = newUser("host");
        Competition c = runningWith(host, List.of(newUser("guest")));
        facade.submit(c.getId(), host, 1, correctIndex(c.getId(), 1));

        assertThrows(ConflictException.class, () -> facade.leaderboard(c.getId(), host));
        assertThrows(ConflictException.class, () -> facade.review(c.getId(), host));
    }

    @Test
    void theReviewRevealsCorrectAnswersOnlyAfterTheEndAndOnlyToParticipants() {
        User host = newUser("host");
        User guest = newUser("guest");
        Competition c = runningWith(host, List.of(guest));
        facade.submit(c.getId(), host, 1, wrongIndex(c.getId(), 1));
        facade.finish(c.getId(), host);
        facade.finish(c.getId(), guest);

        ResultReviewDto review = facade.review(c.getId(), host);

        assertEquals(10, review.items().size());
        ReviewItemDto first = review.items().get(0);
        assertEquals(correctIndex(c.getId(), 1), first.correctOption());
        assertEquals(wrongIndex(c.getId(), 1), first.yourSelectedOption());
        assertFalse(first.correct());
        assertNull(review.items().get(1).yourSelectedOption(), "unanswered");
        assertThrows(ForbiddenException.class, () -> facade.review(c.getId(), newUser("stranger")));
    }

    @Test
    void ties_AreBrokenBySpeedThenDeterministically() {
        User a = newUser("a");
        User b = newUser("b");
        Competition c = runningWith(a, List.of(b));
        facade.submit(c.getId(), a, 1, correctIndex(c.getId(), 1));
        advance(3);
        facade.submit(c.getId(), b, 1, correctIndex(c.getId(), 1));
        facade.finish(c.getId(), b);
        facade.finish(c.getId(), a);

        LeaderboardDto board = facade.leaderboard(c.getId(), a);

        assertEquals(100, board.entries().get(0).score());
        assertEquals(100, board.entries().get(1).score());
        assertEquals(a.getUsername(), board.entries().get(0).username(), "a finished at the same instant as b but answered earlier");
    }

    // ------------------------------------------------------------------ concurrency in the run phase

    @Test
    void manyPlayersSubmittingAtOnceAreAllGradedCorrectly() throws Exception {
        User host = newUser("host");
        List<User> others = newUsers(24);
        Competition c = runningWith(host, others);
        List<User> all = new ArrayList<>(others);
        all.add(host);

        List<Callable<SubmissionResultDto>> tasks = new ArrayList<>();
        for (User u : all) {
            for (int q = 1; q <= 4; q++) {
                int number = q;
                tasks.add(() -> facade.submit(c.getId(), u, number, correctIndex(c.getId(), number)));
            }
        }
        List<Outcome<SubmissionResultDto>> outcomes = runConcurrently(tasks);

        assertTrue(outcomes.stream().allMatch(Outcome::ok), () -> outcomes.stream().filter(o -> !o.ok()).map(Outcome::error).toList().toString());
        assertEquals(100, jdbc.queryForObject("SELECT count(*) FROM competition_submissions WHERE competition_id = ?", Long.class, c.getId()));
        assertEquals(25, jdbc.queryForObject("SELECT count(*) FROM competition_participants WHERE competition_id = ? AND score = 400 AND answered_count = 4", Long.class, c.getId()));
    }

    @Test
    void theSamePlayerSubmittingTheSameQuestionManyTimesAtOnceIsScoredOnce() throws Exception {
        User host = newUser("host");
        Competition c = runningWith(host, List.of(newUser("guest")));
        int right = correctIndex(c.getId(), 1);

        List<Callable<SubmissionResultDto>> tasks = new ArrayList<>();
        for (int i = 0; i < 12; i++) {
            tasks.add(() -> facade.submit(c.getId(), host, 1, right));
        }
        List<Outcome<SubmissionResultDto>> outcomes = runConcurrently(tasks);

        assertTrue(outcomes.stream().allMatch(Outcome::ok));
        assertEquals(1, outcomes.stream().filter(o -> !o.value().alreadySubmitted()).count());
        assertEquals(100, jdbc.queryForObject("SELECT score FROM competition_participants WHERE user_id = ?", Integer.class, host.getId()));
        assertEquals(1, jdbc.queryForObject("SELECT count(*) FROM competition_submissions", Long.class));
    }

    @Test
    void aSubmissionRacingTheFinalizationIsEitherCountedInTheRankingOrRejected() throws Exception {
        for (int round = 0; round < 8; round++) {
            User host = newUser("host");
            User guest = newUser("guest");
            Competition c = runningWith(host, List.of(guest));
            facade.finish(c.getId(), guest);
            advance(1200);
            clock.advance(java.time.Duration.ofMillis(1500));
            int right = correctIndex(c.getId(), 1);

            List<Outcome<Object>> outcomes = runConcurrently(List.of(
                    () -> { lifecycle.advance(c.getId()); return null; },
                    () -> facade.submit(c.getId(), host, 1, right)));

            assertEquals(CompetitionStatus.FINISHED, reload(c.getId()).getStatus());
            int storedScore = jdbc.queryForObject("SELECT score FROM competition_participants WHERE competition_id = ? AND user_id = ?", Integer.class, c.getId(), host.getId());
            long rows = jdbc.queryForObject("SELECT count(*) FROM competition_submissions WHERE competition_id = ?", Long.class, c.getId());
            assertEquals(rows * 100, storedScore, "no answer may be counted without a score or vice versa (round " + round + ")");
            // the submit is rejected here because the time is past the end - it must never silently land after the ranking
            assertEquals(0, rows, "round " + round);
            assertFalse(outcomes.get(1).ok());
            // clean up for the next round (participants are released by finalization)
        }
    }
}
