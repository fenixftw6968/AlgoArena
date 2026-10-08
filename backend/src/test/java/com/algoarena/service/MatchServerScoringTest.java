package com.algoarena.service;

import com.algoarena.dto.MatchAnswerRequest;
import com.algoarena.dto.MatchAnswerResponse;
import com.algoarena.dto.MatchDto;
import com.algoarena.dto.MatchSubmitRequest;
import com.algoarena.entity.Match;
import com.algoarena.entity.User;
import com.algoarena.exception.BadRequestException;
import com.algoarena.exception.ConflictException;
import com.algoarena.exception.ForbiddenException;
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
 * P0.6 - the server is the only authority on correctness, score, time, mistakes and the final
 * result. Tampering attempts must never change an outcome.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class MatchServerScoringTest {

    @Mock private MatchRepository matchRepository;
    @Mock private UserRepository userRepository;
    @Mock private FriendshipRepository friendshipRepository;
    @Spy private EloRatingService eloRatingService = new EloRatingService();
    @Mock private GameService gameService;
    @Spy private ObjectMapper objectMapper = new ObjectMapper();
    @Mock private SimpMessagingTemplate messagingTemplate;
    @Mock private TransactionTemplate transactionTemplate;
    @InjectMocks private MatchService matchService;

    private User host;     // 1
    private User guest;    // 2
    private User outsider; // 3
    private Match match;

    /** Four questions; correct answers: a, b, c, d (as option text). */
    private static String challenge() {
        return MatchChallenge.create(List.of(
                q("Q1", "a"), q("Q2", "b"), q("Q3", "c"), q("Q4", "d")));
    }

    private static Map<String, Object> q(String text, String correct) {
        return Map.of("question", text, "options", List.of("a", "b", "c", "d"),
                "correctAnswer", correct, "explanation", "because " + correct);
    }

    private static MatchAnswerRequest ans(int index, String answer) {
        return MatchAnswerRequest.builder().questionIndex(index).answer(answer).build();
    }

    private static MatchSubmitRequest forged(int score, int time, int mistakes) {
        MatchSubmitRequest r = new MatchSubmitRequest();
        r.setScore(score);
        r.setTimeTakenSeconds(time);
        r.setMistakes(mistakes);
        return r;
    }

    @BeforeEach
    void setUp() {
        host = User.builder().id(1L).username("host").email("h@x.com").competitiveRating(500).matchesPlayed(0).matchesWon(0).build();
        guest = User.builder().id(2L).username("guest").email("g@x.com").competitiveRating(500).matchesPlayed(0).matchesWon(0).build();
        outsider = User.builder().id(3L).username("out").email("o@x.com").competitiveRating(500).build();
        match = Match.builder().id("m1").gameSlug("number-detective").difficulty("MEDIUM")
                .mode(Match.MatchMode.RANKED).status(Match.MatchStatus.READY)
                .player1(host).player2(guest).player1RatingBefore(500).player2RatingBefore(500)
                .challengeData(challenge()).isBotMatch(false)
                .startedAt(LocalDateTime.now().minusSeconds(20)).createdAt(LocalDateTime.now().minusMinutes(1)).build();
        when(matchRepository.findById("m1")).thenReturn(Optional.of(match));
        when(matchRepository.findByIdWithLock("m1")).thenReturn(Optional.of(match));
        when(matchRepository.save(any(Match.class))).thenAnswer(inv -> inv.getArgument(0));
        when(transactionTemplate.execute(any())).thenAnswer(inv ->
                ((TransactionCallback<Object>) inv.getArgument(0)).doInTransaction(null));
    }

    private void answerAll(long userId, String... answers) {
        for (int i = 0; i < answers.length; i++) {
            matchService.submitMatchAnswer("m1", userId, ans(i, answers[i]));
        }
    }

    // ------------------------------------------------------------------ grading

    @Test
    void serverGradesCorrectAndWrongAnswersAndRevealsOnlyAfterGrading() {
        MatchAnswerResponse right = matchService.submitMatchAnswer("m1", 1L, ans(0, "a"));
        MatchAnswerResponse wrong = matchService.submitMatchAnswer("m1", 1L, ans(1, "d"));

        assertTrue(right.isCorrect());
        assertEquals("a", right.getCorrectAnswer());
        assertEquals("because a", right.getExplanation());
        assertFalse(wrong.isCorrect());
        assertEquals("b", wrong.getCorrectAnswer());
        assertEquals(2, wrong.getAnsweredCount());
        assertEquals(4, wrong.getTotalQuestions());
        assertFalse(wrong.isFinished());
    }

    @Test
    void timeoutOrBlankAnswerIsWrong() {
        assertFalse(matchService.submitMatchAnswer("m1", 1L, ans(0, null)).isCorrect());
        assertFalse(matchService.submitMatchAnswer("m1", 1L, ans(1, "   ")).isCorrect());
    }

    @Test
    void finishingTheLastQuestionDerivesScoreMistakesAndTimeOnTheServer() {
        answerAll(1L, "a", "b", "x", "x");

        assertTrue(match.getPlayer1Finished());
        assertEquals(2, match.getPlayer1Score());
        assertEquals(2, match.getPlayer1Mistakes());
        assertTrue(match.getPlayer1TimeSeconds() >= 19 && match.getPlayer1TimeSeconds() <= 40,
                "time must be server-measured from the match start, was " + match.getPlayer1TimeSeconds());
    }

    @Test
    void liveScoresAreNotExposedToTheOpponentWhileThePlayerIsStillAnswering() {
        answerAll(1L, "a", "b");

        MatchDto asGuest = matchService.getMatchStatus("m1", 2L);
        MatchDto asHost = matchService.getMatchStatus("m1", 1L);

        assertEquals(0, match.getPlayer1Score());
        assertEquals(0, asGuest.getPlayer1Score());
        assertEquals(0, asGuest.getViewerAnsweredCount());
        assertEquals(2, asHost.getViewerAnsweredCount());
        assertEquals(2, asHost.getViewerCorrectCount());
    }

    // ------------------------------------------------------------------ tampered /submit

    @Test
    void forgedSubmitWithoutAnyAnsweredQuestionScoresZero() {
        matchService.submitMatchResult("m1", 1L, forged(999, 0, 0));

        assertEquals(0, match.getPlayer1Score());
        assertEquals(4, match.getPlayer1Mistakes());
        assertTrue(match.getPlayer1TimeSeconds() >= 19, "client claimed 0s");
    }

    @Test
    void forgedSubmitCannotInflateAPartialResult() {
        answerAll(1L, "a", "x");

        matchService.submitMatchResult("m1", 1L, forged(10, 1, 0));

        assertEquals(1, match.getPlayer1Score(), "score = server-graded correct answers only");
        assertEquals(3, match.getPlayer1Mistakes(), "unanswered questions count as wrong");
    }

    @Test
    void forgedSubmitByTheLoserCannotFlipTheMatchOrTheRatings() {
        answerAll(1L, "a", "b", "c", "d");          // host: 4/4
        answerAll(2L, "a", "x");                    // guest: 1 correct, then claims a perfect run
        MatchDto result = matchService.submitMatchResult("m1", 2L, forged(4, 1, 0));

        assertEquals("FINISHED", result.getStatus());
        assertEquals(1L, result.getWinnerId());
        assertEquals(4, match.getPlayer1Score());
        assertEquals(1, match.getPlayer2Score());
        assertEquals(525, host.getCompetitiveRating());
        assertEquals(475, guest.getCompetitiveRating());
    }

    @Test
    void ratingDeltaAlwaysComesFromTheServerNotTheClient() {
        answerAll(1L, "a", "b", "c", "d");
        answerAll(2L, "a", "b", "c", "d");          // identical results -> tie-break by server time/mistakes

        assertEquals("FINISHED", match.getStatus().name());
        assertEquals(500 + match.getPlayer1RatingChange(), host.getCompetitiveRating());
        assertTrue(Math.abs(match.getPlayer1RatingChange()) == 25 || match.getPlayer1RatingChange() == 0);
    }

    // ------------------------------------------------------------------ cannot change / replay / skip

    @Test
    void aPreviousAnswerCannotBeChanged() {
        matchService.submitMatchAnswer("m1", 1L, ans(0, "x"));                       // wrong first answer

        MatchAnswerResponse retry = matchService.submitMatchAnswer("m1", 1L, ans(0, "a")); // try the right one

        assertFalse(retry.isCorrect(), "the first answer stands");
        assertTrue(retry.isAlreadyAnswered());
        assertEquals(1, retry.getAnsweredCount());
        matchService.submitMatchAnswer("m1", 1L, ans(1, "b"));
        matchService.submitMatchAnswer("m1", 1L, ans(2, "c"));
        matchService.submitMatchAnswer("m1", 1L, ans(3, "d"));
        assertEquals(3, match.getPlayer1Score());
    }

    @Test
    void replayingTheSameAnswerIsIdempotent() {
        matchService.submitMatchAnswer("m1", 1L, ans(0, "a"));
        MatchAnswerResponse replay = matchService.submitMatchAnswer("m1", 1L, ans(0, "a"));

        assertTrue(replay.isAlreadyAnswered());
        assertEquals(1, replay.getAnsweredCount());
        assertEquals(1, MatchChallenge.parse(match.getChallengeData()).answeredCount(MatchChallenge.P1));
    }

    @Test
    void questionsMustBeAnsweredInOrder() {
        assertThrows(ConflictException.class, () -> matchService.submitMatchAnswer("m1", 1L, ans(2, "c")));
        matchService.submitMatchAnswer("m1", 1L, ans(0, "a"));
        assertThrows(ConflictException.class, () -> matchService.submitMatchAnswer("m1", 1L, ans(3, "d")));
        assertEquals(1, MatchChallenge.parse(match.getChallengeData()).answeredCount(MatchChallenge.P1));
    }

    @Test
    void unknownQuestionIndexIsRejected() {
        assertThrows(BadRequestException.class, () -> matchService.submitMatchAnswer("m1", 1L, ans(4, "a")));
        assertThrows(BadRequestException.class, () -> matchService.submitMatchAnswer("m1", 1L, ans(-1, "a")));
    }

    @Test
    void cannotKeepAnsweringAfterFinishing() {
        answerAll(1L, "a", "b", "c", "d");

        assertThrows(BadRequestException.class, () -> matchService.submitMatchAnswer("m1", 1L, ans(4, "a")));
        MatchAnswerResponse replay = matchService.submitMatchAnswer("m1", 1L, ans(3, "x"));
        assertTrue(replay.isAlreadyAnswered());
        assertEquals(4, match.getPlayer1Score());
    }

    @Test
    void secondFinalSubmitNeverRewritesTheResult() {
        answerAll(1L, "a", "b", "c", "d");
        matchService.submitMatchResult("m1", 1L, forged(0, 999, 4));

        assertEquals(4, match.getPlayer1Score());
        assertEquals(0, match.getPlayer1Mistakes());
    }

    // ------------------------------------------------------------------ who / when

    @Test
    void nonParticipantCannotAnswerAndChangesNothing() {
        assertThrows(ForbiddenException.class, () -> matchService.submitMatchAnswer("m1", 3L, ans(0, "a")));
        assertEquals(0, MatchChallenge.parse(match.getChallengeData()).answeredCount(MatchChallenge.P1));
        assertEquals(0, MatchChallenge.parse(match.getChallengeData()).answeredCount(MatchChallenge.P2));
    }

    @Test
    void eachPlayerAnswersOnlyIntoTheirOwnSlot() {
        matchService.submitMatchAnswer("m1", 1L, ans(0, "a"));
        matchService.submitMatchAnswer("m1", 2L, ans(0, "x"));

        MatchChallenge stored = MatchChallenge.parse(match.getChallengeData());
        assertEquals(1, stored.correctCount(MatchChallenge.P1));
        assertEquals(0, stored.correctCount(MatchChallenge.P2));
        assertEquals(1, stored.answeredCount(MatchChallenge.P2));
    }

    @Test
    void answersAreRejectedUnlessTheMatchIsRunning() {
        for (Match.MatchStatus status : List.of(Match.MatchStatus.WAITING, Match.MatchStatus.CANCELLED)) {
            match.setStatus(status);
            assertThrows(ConflictException.class, () -> matchService.submitMatchAnswer("m1", 1L, ans(0, "a")));
        }
        match.setStatus(Match.MatchStatus.FINISHED);
        assertThrows(ConflictException.class, () -> matchService.submitMatchAnswer("m1", 1L, ans(0, "a")));
        assertEquals(0, match.getPlayer1Score());
    }

    @Test
    void cannotAnswerBeforeTheMatchHasStarted() {
        match.setStartedAt(LocalDateTime.now().plusSeconds(30));

        assertThrows(ConflictException.class, () -> matchService.submitMatchAnswer("m1", 1L, ans(0, "a")));
    }

    @Test
    void cannotAnswerAfterTheOpponentForfeitedTheMatchAway() {
        matchService.abandonMatch("m1", 2L);        // guest quits -> match FINISHED

        assertThrows(ConflictException.class, () -> matchService.submitMatchAnswer("m1", 1L, ans(0, "a")));
    }

    @Test
    void answersAreProcessedUnderTheMatchRowLock() {
        matchService.submitMatchAnswer("m1", 1L, ans(0, "a"));

        verify(matchRepository).findByIdWithLock("m1");
    }

    // ------------------------------------------------------------------ bot matches

    @Test
    void botResultIsDerivedFromTheServerGradedScore() {
        match.setIsBotMatch(true);
        match.setPlayer2(null);

        answerAll(1L, "x", "x", "x", "x");           // 0 correct

        assertEquals("FINISHED", match.getStatus().name());
        assertEquals(0, match.getPlayer1Score());
        assertTrue(match.getPlayer2Score() <= 1, "bot score is anchored to the player's SERVER score (0 +/- 1)");
    }
}
