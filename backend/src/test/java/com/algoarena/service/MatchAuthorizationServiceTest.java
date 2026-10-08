package com.algoarena.service;

import com.algoarena.dto.MatchDto;
import com.algoarena.dto.MatchSubmitRequest;
import com.algoarena.entity.Friendship;
import com.algoarena.entity.Match;
import com.algoarena.entity.User;
import com.algoarena.exception.BadRequestException;
import com.algoarena.exception.ConflictException;
import com.algoarena.exception.ForbiddenException;
import com.algoarena.exception.ResourceNotFoundException;
import com.algoarena.repository.FriendshipRepository;
import com.algoarena.repository.MatchRepository;
import com.algoarena.repository.UserRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.transaction.support.TransactionCallback;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/**
 * P0.4 - authorization and state-integrity rules of the 1v1 match endpoints at service level.
 * Participant -> allowed, non-participant -> ForbiddenException, bad state -> no mutation.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class MatchAuthorizationServiceTest {

    @Mock private MatchRepository matchRepository;
    @Mock private UserRepository userRepository;
    @Mock private FriendshipRepository friendshipRepository;
    @Spy private EloRatingService eloRatingService = new EloRatingService();
    @Mock private GameService gameService;
    @Spy private ObjectMapper objectMapper = new ObjectMapper();
    @Mock private SimpMessagingTemplate messagingTemplate;
    @Mock private TransactionTemplate transactionTemplate;

    @InjectMocks private MatchService matchService;

    private User host;        // id 1
    private User guest;       // id 2
    private User outsider;    // id 3

    @BeforeEach
    void setUp() {
        host = user(1L, "host");
        guest = user(2L, "guest");
        outsider = user(3L, "outsider");

        when(transactionTemplate.execute(any())).thenAnswer(inv ->
                ((TransactionCallback<Object>) inv.getArgument(0)).doInTransaction(null));
        when(matchRepository.save(any(Match.class))).thenAnswer(inv -> inv.getArgument(0));
        when(userRepository.findById(1L)).thenReturn(Optional.of(host));
        when(userRepository.findById(2L)).thenReturn(Optional.of(guest));
        when(userRepository.findById(3L)).thenReturn(Optional.of(outsider));
    }

    private static User user(long id, String name) {
        return User.builder().id(id).username(name).email(name + "@x.com")
                .competitiveRating(500).matchesPlayed(0).matchesWon(0).build();
    }

    private Match match(String id, Match.MatchMode mode, Match.MatchStatus status, User p1, User p2) {
        Match m = Match.builder()
                .id(id).gameSlug("number-detective").difficulty("MEDIUM")
                .mode(mode).status(status).player1(p1).player2(p2)
                .player1RatingBefore(500).player2RatingBefore(500)
                .challengeData("[]").isBotMatch(false)
                .createdAt(LocalDateTime.now())
                .build();
        when(matchRepository.findById(id)).thenReturn(Optional.of(m));
        when(matchRepository.findByIdWithLock(id)).thenReturn(Optional.of(m));
        return m;
    }

    private static MatchSubmitRequest submission(int score) {
        MatchSubmitRequest r = new MatchSubmitRequest();
        r.setScore(score);
        r.setTimeTakenSeconds(30);
        r.setMistakes(0);
        return r;
    }

    // ------------------------------------------------------------------ GET /{id}

    @Test
    void getMatchStatusAllowsBothParticipants() {
        match("m1", Match.MatchMode.RANKED, Match.MatchStatus.READY, host, guest);

        assertEquals("m1", matchService.getMatchStatus("m1", 1L).getId());
        assertEquals("m1", matchService.getMatchStatus("m1", 2L).getId());
    }

    @Test
    void getMatchStatusRejectsNonParticipant() {
        match("m1", Match.MatchMode.RANKED, Match.MatchStatus.READY, host, guest);

        assertThrows(ForbiddenException.class, () -> matchService.getMatchStatus("m1", 3L));
    }

    @Test
    void getMatchStatusRejectsNonParticipantEvenForFinishedMatch() {
        match("m1", Match.MatchMode.RANKED, Match.MatchStatus.FINISHED, host, guest);

        assertThrows(ForbiddenException.class, () -> matchService.getMatchStatus("m1", 3L));
    }

    @Test
    void getMatchStatusUnknownMatchIsNotFound() {
        when(matchRepository.findById("nope")).thenReturn(Optional.empty());

        assertThrows(ResourceNotFoundException.class, () -> matchService.getMatchStatus("nope", 1L));
    }

    @Test
    void getMatchStatusOfWaitingMatchWithoutOpponentRejectsOutsider() {
        match("m1", Match.MatchMode.RANKED, Match.MatchStatus.WAITING, host, null);

        assertThrows(ForbiddenException.class, () -> matchService.getMatchStatus("m1", 3L));
        assertDoesNotThrow(() -> matchService.getMatchStatus("m1", 1L));
    }

    // ------------------------------------------------------------------ submit

    @Test
    void submitRejectsNonParticipantAndChangesNothing() {
        Match m = match("m1", Match.MatchMode.RANKED, Match.MatchStatus.READY, host, guest);

        assertThrows(ForbiddenException.class, () -> matchService.submitMatchResult("m1", 3L, submission(10)));

        assertEquals(0, m.getPlayer1Score());
        assertEquals(0, m.getPlayer2Score());
        verify(matchRepository, never()).save(any());
    }

    @Test
    void submitToWaitingMatchIsRejected() {
        match("m1", Match.MatchMode.RANKED, Match.MatchStatus.WAITING, host, null);

        assertThrows(ConflictException.class, () -> matchService.submitMatchResult("m1", 1L, submission(10)));
        verify(matchRepository, never()).save(any());
    }

    @Test
    void submitToCancelledMatchIsRejectedAndNeverTouchesRatings() {
        Match m = match("m1", Match.MatchMode.RANKED, Match.MatchStatus.CANCELLED, host, guest);
        m.setPlayer1Finished(true);
        m.setPlayer1Score(3);

        assertThrows(ConflictException.class, () -> matchService.submitMatchResult("m1", 2L, submission(10)));

        assertEquals(Match.MatchStatus.CANCELLED, m.getStatus());
        assertEquals(500, host.getCompetitiveRating());
        assertEquals(500, guest.getCompetitiveRating());
        verify(userRepository, never()).save(any());
    }

    @Test
    void submitToFinishedMatchIsHarmlessNoOp() {
        Match m = match("m1", Match.MatchMode.RANKED, Match.MatchStatus.FINISHED, host, guest);
        m.setPlayer1Score(7);
        m.setPlayer2Score(4);
        m.setPlayer1Finished(true);
        m.setPlayer2Finished(true);

        MatchDto dto = matchService.submitMatchResult("m1", 2L, submission(99));

        assertEquals("FINISHED", dto.getStatus());
        assertEquals(7, m.getPlayer1Score());
        assertEquals(4, m.getPlayer2Score());
        verify(matchRepository, never()).save(any());
    }

    @Test
    void secondSubmitByTheSamePlayerIsANoOp() {
        Match m = match("m1", Match.MatchMode.RANKED, Match.MatchStatus.READY, host, guest);
        m.setChallengeData(MatchChallenge.create(List.of(Map.of("question", "q", "options", List.of("a", "b"), "correctAnswer", "a"))));

        matchService.submitMatchResult("m1", 1L, submission(99)); // client claims 99; server derives 0
        assertEquals(0, m.getPlayer1Score());
        assertTrue(m.getPlayer1Finished());

        matchService.submitMatchResult("m1", 1L, submission(10));

        assertEquals(0, m.getPlayer1Score(), "first official result must stand");
        assertEquals(Match.MatchStatus.READY, m.getStatus());
    }

    @Test
    void submitWorksForBothParticipantsAndFinalisesOnce() {
        Match m = match("m1", Match.MatchMode.RANKED, Match.MatchStatus.READY, host, guest);
        m.setStartedAt(LocalDateTime.now().minusSeconds(30));
        m.setChallengeData(MatchChallenge.create(List.of(
                Map.of("question", "q1", "options", List.of("a", "b"), "correctAnswer", "a"),
                Map.of("question", "q2", "options", List.of("a", "b"), "correctAnswer", "b"))));

        // host answers both correctly, guest gets one wrong - all graded by the server
        matchService.submitMatchAnswer("m1", 1L, answer(0, "a"));
        matchService.submitMatchAnswer("m1", 1L, answer(1, "b"));
        matchService.submitMatchAnswer("m1", 2L, answer(0, "a"));
        matchService.submitMatchAnswer("m1", 2L, answer(1, "a"));
        MatchDto result = matchService.submitMatchResult("m1", 2L, submission(99));

        assertEquals("FINISHED", result.getStatus());
        assertEquals(1L, result.getWinnerId());
        assertEquals(525, host.getCompetitiveRating());
        assertEquals(475, guest.getCompetitiveRating());

        // A late replay after finalisation must not move ratings again.
        matchService.submitMatchResult("m1", 2L, submission(9));
        assertEquals(525, host.getCompetitiveRating());
        assertEquals(475, guest.getCompetitiveRating());
    }

    private static com.algoarena.dto.MatchAnswerRequest answer(int index, String text) {
        return com.algoarena.dto.MatchAnswerRequest.builder().questionIndex(index).answer(text).build();
    }

    // ------------------------------------------------------------------ accept

    @Test
    void acceptByInvitedPlayerMakesMatchReady() {
        Match m = match("f1", Match.MatchMode.FRIEND, Match.MatchStatus.WAITING, host, guest);

        MatchDto dto = matchService.acceptFriendMatch("f1", 2L);

        assertEquals("READY", dto.getStatus());
        assertEquals(Match.MatchStatus.READY, m.getStatus());
    }

    @Test
    void acceptRejectsHostOutsiderAndRankedMatchWithoutNpe() {
        match("f1", Match.MatchMode.FRIEND, Match.MatchStatus.WAITING, host, guest);
        match("r1", Match.MatchMode.RANKED, Match.MatchStatus.WAITING, host, null);
        match("r2", Match.MatchMode.RANKED, Match.MatchStatus.READY, host, guest);

        assertThrows(ForbiddenException.class, () -> matchService.acceptFriendMatch("f1", 1L));
        assertThrows(ForbiddenException.class, () -> matchService.acceptFriendMatch("f1", 3L));
        // ranked match with no second player used to crash with an NPE (HTTP 500)
        assertThrows(ForbiddenException.class, () -> matchService.acceptFriendMatch("r1", 3L));
        // a ranked opponent is not an "invited player"
        assertThrows(ForbiddenException.class, () -> matchService.acceptFriendMatch("r2", 2L));
    }

    @Test
    void acceptOfCancelledInvitationIsConflict() {
        match("f1", Match.MatchMode.FRIEND, Match.MatchStatus.CANCELLED, host, guest);

        assertThrows(ConflictException.class, () -> matchService.acceptFriendMatch("f1", 2L));
    }

    @Test
    void acceptOfExpiredInvitationIsRejectedAndLeavesMatchUntouched() {
        Match m = match("f1", Match.MatchMode.FRIEND, Match.MatchStatus.WAITING, host, guest);
        m.setCreatedAt(LocalDateTime.now().minusMinutes(10));

        assertThrows(ConflictException.class, () -> matchService.acceptFriendMatch("f1", 2L));

        assertEquals(Match.MatchStatus.WAITING, m.getStatus());
        assertNull(m.getStartedAt());
    }

    // ------------------------------------------------------------------ decline

    @Test
    void declineByInvitedPlayerCancelsPendingInvitation() {
        Match m = match("f1", Match.MatchMode.FRIEND, Match.MatchStatus.WAITING, host, guest);

        matchService.declineFriendMatch("f1", 2L);

        assertEquals(Match.MatchStatus.CANCELLED, m.getStatus());
        assertEquals("DECLINED", m.getCancelledReason());
    }

    @Test
    void declineRejectsNonInviteeAndRankedOpponent() {
        match("f1", Match.MatchMode.FRIEND, Match.MatchStatus.WAITING, host, guest);
        match("r1", Match.MatchMode.RANKED, Match.MatchStatus.READY, host, guest);
        match("r2", Match.MatchMode.RANKED, Match.MatchStatus.WAITING, host, null);

        assertThrows(ForbiddenException.class, () -> matchService.declineFriendMatch("f1", 1L));
        assertThrows(ForbiddenException.class, () -> matchService.declineFriendMatch("f1", 3L));
        assertThrows(ForbiddenException.class, () -> matchService.declineFriendMatch("r1", 2L));
        assertThrows(ForbiddenException.class, () -> matchService.declineFriendMatch("r2", 3L));
    }

    @Test
    void declineCannotCancelARunningOrFinishedMatch() {
        Match running = match("f1", Match.MatchMode.FRIEND, Match.MatchStatus.READY, host, guest);
        Match finished = match("f2", Match.MatchMode.FRIEND, Match.MatchStatus.FINISHED, host, guest);

        assertThrows(ConflictException.class, () -> matchService.declineFriendMatch("f1", 2L));
        assertThrows(ConflictException.class, () -> matchService.declineFriendMatch("f2", 2L));

        assertEquals(Match.MatchStatus.READY, running.getStatus());
        assertEquals(Match.MatchStatus.FINISHED, finished.getStatus());
    }

    @Test
    void repeatedDeclineIsASafeNoOp() {
        Match m = match("f1", Match.MatchMode.FRIEND, Match.MatchStatus.CANCELLED, host, guest);
        m.setCancelledReason("DECLINED");

        MatchDto dto = matchService.declineFriendMatch("f1", 2L);

        assertEquals("CANCELLED", dto.getStatus());
    }

    // ------------------------------------------------------------------ cancel

    @Test
    void cancelRejectsNonParticipant() {
        Match m = match("m1", Match.MatchMode.RANKED, Match.MatchStatus.WAITING, host, null);

        assertThrows(ForbiddenException.class, () -> matchService.cancelMatch("m1", 3L));
        assertEquals(Match.MatchStatus.WAITING, m.getStatus());
    }

    @Test
    void cancelBeforeStartCancelsMatch() {
        Match m = match("m1", Match.MatchMode.RANKED, Match.MatchStatus.READY, host, guest);
        m.setStartedAt(LocalDateTime.now().plusSeconds(4)); // countdown still running

        MatchDto dto = matchService.cancelMatch("m1", 1L);

        assertEquals("CANCELLED", dto.getStatus());
        assertEquals("CANCELLED_BY_HOST", m.getCancelledReason());
        assertEquals(500, host.getCompetitiveRating());
    }

    @Test
    void cancelOfWaitingMatchByHostWorks() {
        Match m = match("m1", Match.MatchMode.RANKED, Match.MatchStatus.WAITING, host, null);

        matchService.cancelMatch("m1", 1L);

        assertEquals(Match.MatchStatus.CANCELLED, m.getStatus());
    }

    @Test
    void cancelOfFinishedOrCancelledMatchIsImmutableNoOp() {
        Match finished = match("m1", Match.MatchMode.RANKED, Match.MatchStatus.FINISHED, host, guest);
        finished.setWinnerId(1L);
        Match cancelled = match("m2", Match.MatchMode.RANKED, Match.MatchStatus.CANCELLED, host, guest);
        cancelled.setCancelledReason("DECLINED");

        assertEquals("FINISHED", matchService.cancelMatch("m1", 2L).getStatus());
        assertEquals("CANCELLED", matchService.cancelMatch("m2", 2L).getStatus());

        assertEquals(Match.MatchStatus.FINISHED, finished.getStatus());
        assertEquals(1L, finished.getWinnerId());
        assertNull(finished.getCancelledReason());
        assertEquals("DECLINED", cancelled.getCancelledReason());
        verify(matchRepository, never()).save(any());
    }

    @Test
    void cancelAfterMatchStartedIsTreatedAsForfeit() {
        Match m = match("m1", Match.MatchMode.RANKED, Match.MatchStatus.READY, host, guest);
        m.setStartedAt(LocalDateTime.now().minusSeconds(20)); // being played

        MatchDto dto = matchService.cancelMatch("m1", 1L); // host is "losing" and tries to dodge

        assertEquals("FINISHED", dto.getStatus());
        assertEquals(2L, dto.getWinnerId());
        assertEquals("ABANDONED", m.getCancelledReason());
        assertEquals(475, host.getCompetitiveRating(), "dodging via cancel must cost the same as abandoning");
        assertEquals(525, guest.getCompetitiveRating());
    }

    // ------------------------------------------------------------------ abandon

    @Test
    void abandonRejectsNonParticipant() {
        Match m = match("m1", Match.MatchMode.RANKED, Match.MatchStatus.READY, host, guest);
        m.setStartedAt(LocalDateTime.now().minusSeconds(5));

        assertThrows(ForbiddenException.class, () -> matchService.abandonMatch("m1", 3L));
        assertEquals(Match.MatchStatus.READY, m.getStatus());
    }

    @Test
    void abandonRunningMatchForfeitsForTheAbandoningPlayer() {
        Match m = match("m1", Match.MatchMode.RANKED, Match.MatchStatus.READY, host, guest);
        m.setStartedAt(LocalDateTime.now().minusSeconds(5));

        MatchDto dto = matchService.abandonMatch("m1", 2L);

        assertEquals("FINISHED", dto.getStatus());
        assertEquals(1L, dto.getWinnerId());
        assertEquals(525, host.getCompetitiveRating());
        assertEquals(475, guest.getCompetitiveRating());
    }

    @Test
    void abandonCannotRewriteFinishedOrCancelledMatches() {
        Match finished = match("m1", Match.MatchMode.RANKED, Match.MatchStatus.FINISHED, host, guest);
        finished.setWinnerId(1L);
        Match cancelled = match("m2", Match.MatchMode.RANKED, Match.MatchStatus.CANCELLED, host, guest);

        matchService.abandonMatch("m1", 2L);
        matchService.abandonMatch("m2", 2L);

        assertEquals(Match.MatchStatus.FINISHED, finished.getStatus());
        assertNull(finished.getCancelledReason());
        assertEquals(Match.MatchStatus.CANCELLED, cancelled.getStatus());
        verify(matchRepository, never()).save(any());
    }

    @Test
    void abandonUsesTheLockedReadSoItCannotRaceWithSubmit() {
        match("m1", Match.MatchMode.RANKED, Match.MatchStatus.WAITING, host, null);

        matchService.abandonMatch("m1", 1L);

        verify(matchRepository).findByIdWithLock("m1");
    }

    // ------------------------------------------------------------------ connect-bot

    @Test
    void connectBotRejectsNonHost() {
        match("m1", Match.MatchMode.RANKED, Match.MatchStatus.WAITING, host, null);
        match("m2", Match.MatchMode.RANKED, Match.MatchStatus.READY, host, guest);

        assertThrows(ForbiddenException.class, () -> matchService.connectBotMatch("m1", 3L));
        assertThrows(ForbiddenException.class, () -> matchService.connectBotMatch("m2", 2L));
    }

    @Test
    void connectBotCannotHijackAFriendInvitation() {
        Match m = match("f1", Match.MatchMode.FRIEND, Match.MatchStatus.WAITING, host, guest);

        assertThrows(ConflictException.class, () -> matchService.connectBotMatch("f1", 1L));

        assertEquals(Match.MatchMode.FRIEND, m.getMode());
        assertFalse(Boolean.TRUE.equals(m.getIsBotMatch()));
        assertEquals(Match.MatchStatus.WAITING, m.getStatus());
    }

    @Test
    void connectBotForHostOfWaitingRankedMatchWorksAndIsIdempotent() {
        Match m = match("m1", Match.MatchMode.RANKED, Match.MatchStatus.WAITING, host, null);

        MatchDto first = matchService.connectBotMatch("m1", 1L);
        LocalDateTime armedAt = m.getStartedAt();
        MatchDto second = matchService.connectBotMatch("m1", 1L);

        assertEquals("READY", first.getStatus());
        assertTrue(m.getIsBotMatch());
        assertEquals(armedAt, m.getStartedAt(), "a repeat call must not re-arm the start time");
        assertEquals("READY", second.getStatus());
    }

    // ------------------------------------------------------------------ invite

    private void befriend(User a, User b, Friendship.Status status) {
        Friendship f = Friendship.builder().user(a).friend(b).status(status).build();
        when(friendshipRepository.findBetweenUsers(a, b)).thenReturn(Optional.of(f));
        when(friendshipRepository.findBetweenUsers(b, a)).thenReturn(Optional.of(f));
    }

    @Test
    void inviteRequiresAcceptedFriendship() {
        // no friendship at all
        when(friendshipRepository.findBetweenUsers(any(), any())).thenReturn(Optional.empty());
        assertThrows(ForbiddenException.class, () -> matchService.createFriendMatch(1L, 3L, "number-detective", "EASY"));

        // pending / declined / blocked do not count
        for (Friendship.Status s : List.of(Friendship.Status.PENDING, Friendship.Status.DECLINED, Friendship.Status.BLOCKED)) {
            befriend(host, outsider, s);
            assertThrows(ForbiddenException.class, () -> matchService.createFriendMatch(1L, 3L, "number-detective", "EASY"));
        }
        verify(matchRepository, never()).save(any());
    }

    @Test
    void inviteToSelfIsRejected() {
        assertThrows(BadRequestException.class, () -> matchService.createFriendMatch(1L, 1L, "number-detective", "EASY"));
        verify(matchRepository, never()).save(any());
    }

    @Test
    void inviteToAcceptedFriendCreatesWaitingFriendMatch() {
        befriend(host, guest, Friendship.Status.ACCEPTED);
        when(matchRepository.findPendingInvitationsForUser(guest)).thenReturn(List.of());

        MatchDto dto = matchService.createFriendMatch(1L, 2L, "Number-Detective", null);

        assertEquals("WAITING", dto.getStatus());
        assertEquals("FRIEND", dto.getMode());
        assertEquals("number-detective", dto.getGameSlug());
        assertEquals("MEDIUM", dto.getDifficulty());
    }

    @Test
    void inviteOnlyReplacesTheHostsOwnPreviousInvitationNotOtherHosts() {
        befriend(host, guest, Friendship.Status.ACCEPTED);
        Match mine = match("old-mine", Match.MatchMode.FRIEND, Match.MatchStatus.WAITING, host, guest);
        Match theirs = match("old-theirs", Match.MatchMode.FRIEND, Match.MatchStatus.WAITING, outsider, guest);
        when(matchRepository.findPendingInvitationsForUser(guest)).thenReturn(List.of(mine, theirs));

        matchService.createFriendMatch(1L, 2L, "number-detective", "HARD");

        assertEquals(Match.MatchStatus.CANCELLED, mine.getStatus());
        assertEquals(Match.MatchStatus.WAITING, theirs.getStatus(), "other users' invitations must be left alone");
    }

    @Test
    void inviteRejectsUnsupportedGameAndDifficulty() {
        befriend(host, guest, Friendship.Status.ACCEPTED);

        assertThrows(BadRequestException.class, () -> matchService.createFriendMatch(1L, 2L, "../application", "EASY"));
        assertThrows(BadRequestException.class, () -> matchService.createFriendMatch(1L, 2L, "not-a-game", "EASY"));
        assertThrows(BadRequestException.class, () -> matchService.createFriendMatch(1L, 2L, "", "EASY"));
        assertThrows(BadRequestException.class, () -> matchService.createFriendMatch(1L, 2L, null, "EASY"));
        assertThrows(BadRequestException.class, () -> matchService.createFriendMatch(1L, 2L, "number-detective", "IMPOSSIBLE"));
        verify(matchRepository, never()).save(any());
    }

    // ------------------------------------------------------------------ queue input validation

    @Test
    void queueRejectsUnsupportedGameSlugsAndDifficulty() {
        assertThrows(BadRequestException.class, () -> matchService.queueForMatch(1L, "../application", "EASY"));
        assertThrows(BadRequestException.class, () -> matchService.queueForMatch(1L, "grid-puzzle", "EASY"));
        assertThrows(BadRequestException.class, () -> matchService.queueForMatch(1L, " ", null));
        assertThrows(BadRequestException.class, () -> matchService.queueForMatch(1L, "number-detective", "nightmare"));
        verify(matchRepository, never()).save(any());
    }

    @Test
    void queueAcceptsExactlyTheFourApprovedGames() {
        when(matchRepository.findWaitingMatchesByUser(host)).thenReturn(List.of());
        for (String slug : List.of("dsa-master-quiz", "logic-puzzle", "number-detective", "code-breaker")) {
            assertDoesNotThrow(() -> matchService.queueForMatch(1L, slug, "MEDIUM"), slug);
        }
    }
}
