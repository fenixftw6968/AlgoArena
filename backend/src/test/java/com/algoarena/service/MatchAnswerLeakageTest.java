package com.algoarena.service;

import com.algoarena.dto.MatchAnswerRequest;
import com.algoarena.dto.MatchAnswerResponse;
import com.algoarena.dto.MatchDto;
import com.algoarena.dto.MatchSubmitRequest;
import com.algoarena.entity.Friendship;
import com.algoarena.entity.Match;
import com.algoarena.entity.Puzzle;
import com.algoarena.entity.User;
import com.algoarena.repository.FriendshipRepository;
import com.algoarena.repository.MatchRepository;
import com.algoarena.repository.PuzzleRepository;
import com.algoarena.repository.UserRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.transaction.support.TransactionCallback;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

/**
 * P0.5 - every way a match can reach a client (REST DTOs, STOMP broadcasts, user events, fallback
 * DB puzzles) must be free of answers, explanations and other hidden solution data.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class MatchAnswerLeakageTest {

    private static final String[] CANARIES = {
            "CANARY-ANSWER", "CANARY-EXPLANATION", "CANARY-SECRET", "CANARY-SOLUTION", "CANARY-NESTED", "CANARY-DEEP"};

    private final ObjectMapper json = new ObjectMapper().findAndRegisterModules();

    @Mock private MatchRepository matchRepository;
    @Mock private UserRepository userRepository;
    @Mock private FriendshipRepository friendshipRepository;
    @Spy private EloRatingService eloRatingService = new EloRatingService();
    @Mock private GameService gameService;
    @Spy private ObjectMapper objectMapper = new ObjectMapper();
    @Mock private SimpMessagingTemplate messagingTemplate;
    @Mock private TransactionTemplate transactionTemplate;
    @InjectMocks private MatchService matchService;

    private User host;
    private User guest;

    @BeforeEach
    void setUp() {
        host = User.builder().id(1L).username("host").email("h@x.com").competitiveRating(500).matchesPlayed(0).matchesWon(0).build();
        guest = User.builder().id(2L).username("guest").email("g@x.com").competitiveRating(500).matchesPlayed(0).matchesWon(0).build();
        when(transactionTemplate.execute(any())).thenAnswer(inv ->
                ((TransactionCallback<Object>) inv.getArgument(0)).doInTransaction(null));
        when(matchRepository.save(any(Match.class))).thenAnswer(inv -> inv.getArgument(0));
        when(userRepository.findById(1L)).thenReturn(Optional.of(host));
        when(userRepository.findById(2L)).thenReturn(Optional.of(guest));
    }

    private String canaryChallenge() {
        return MatchChallenge.create(List.of(
                Map.of("id", "q1", "question", "Pick", "options", List.of("a", "b"), "hint", "h",
                        "correctAnswer", "CANARY-ANSWER", "explanation", "CANARY-EXPLANATION",
                        "secret", "CANARY-SECRET",
                        "meta", Map.of("solution", "CANARY-SOLUTION"),
                        "questions", List.of(Map.of("id", "s", "answer", "CANARY-NESTED", "deep", List.of(Map.of("correctAnswer", "CANARY-DEEP"))))),
                Map.of("id", "q2", "question", "Pick again", "options", List.of("a", "b"), "correctAnswer", "CANARY-ANSWER",
                        "explanation", "CANARY-EXPLANATION")));
    }

    private Match match(String id, Match.MatchMode mode, Match.MatchStatus status, User p1, User p2) {
        Match m = Match.builder().id(id).gameSlug("number-detective").difficulty("MEDIUM")
                .mode(mode).status(status).player1(p1).player2(p2)
                .player1RatingBefore(500).player2RatingBefore(500)
                .challengeData(canaryChallenge()).isBotMatch(false)
                .startedAt(LocalDateTime.now().minusSeconds(10))
                .createdAt(LocalDateTime.now()).build();
        when(matchRepository.findById(id)).thenReturn(Optional.of(m));
        when(matchRepository.findByIdWithLock(id)).thenReturn(Optional.of(m));
        return m;
    }

    private void assertClean(Object payload, String where) throws Exception {
        String serialised = json.writeValueAsString(payload);
        for (String canary : CANARIES) {
            assertFalse(serialised.contains(canary), where + " leaked " + canary);
        }
        JsonNode tree = json.readTree(serialised);
        // challengeData travels as a JSON string; check inside it too
        findChallengeData(tree, where);
    }

    private void findChallengeData(JsonNode node, String where) throws Exception {
        if (node.isObject()) {
            for (var it = node.fields(); it.hasNext(); ) {
                var e = it.next();
                if ("challengeData".equals(e.getKey()) && e.getValue().isTextual()) {
                    MatchChallengeTest.assertNoForbiddenKeys(json.readTree(e.getValue().asText()), where + ".challengeData");
                } else {
                    findChallengeData(e.getValue(), where);
                }
            }
        } else if (node.isArray()) {
            for (JsonNode child : node) {
                findChallengeData(child, where);
            }
        }
    }

    // ------------------------------------------------------------------ REST responses

    @Test
    void getMatchStatusAndActiveMatchAreClean() throws Exception {
        Match m = match("m1", Match.MatchMode.RANKED, Match.MatchStatus.READY, host, guest);
        when(matchRepository.findActiveMatchesByUserAndGame(any(), anyString(), any())).thenReturn(List.of(m));

        assertClean(matchService.getMatchStatus("m1", 1L), "getMatchStatus");
        assertClean(matchService.getMatchStatus("m1", 2L), "getMatchStatus(p2)");
        assertClean(matchService.getActiveMatch(1L, "number-detective"), "getActiveMatch");
    }

    @Test
    void pendingInvitationsAndRecentMatchesAreClean() throws Exception {
        Match invite = match("f1", Match.MatchMode.FRIEND, Match.MatchStatus.WAITING, host, guest);
        Match done = match("m2", Match.MatchMode.RANKED, Match.MatchStatus.FINISHED, host, guest);
        when(matchRepository.findPendingInvitationsForUser(guest)).thenReturn(List.of(invite));
        when(matchRepository.findRecentMatchesByUser(host)).thenReturn(List.of(done));

        assertClean(matchService.getPendingInvitations(2L), "pendingInvitations");
        assertClean(matchService.getRecentMatches(1L), "recentMatches");
    }

    @Test
    void acceptConnectBotAndSubmitResponsesAreClean() throws Exception {
        match("f1", Match.MatchMode.FRIEND, Match.MatchStatus.WAITING, host, guest);
        match("r1", Match.MatchMode.RANKED, Match.MatchStatus.WAITING, host, null);
        match("m3", Match.MatchMode.RANKED, Match.MatchStatus.READY, host, guest);

        assertClean(matchService.acceptFriendMatch("f1", 2L), "accept");
        assertClean(matchService.connectBotMatch("r1", 1L), "connectBot");
        assertClean(matchService.submitMatchResult("m3", 1L, new MatchSubmitRequest()), "submit");
        assertClean(matchService.cancelMatch("f1", 1L), "cancel");
    }

    @Test
    void answerResponseDoesNotLeakOtherQuestionsOrTheWholeChallenge() throws Exception {
        match("m1", Match.MatchMode.RANKED, Match.MatchStatus.READY, host, guest);

        MatchAnswerResponse response = matchService.submitMatchAnswer("m1", 1L,
                MatchAnswerRequest.builder().questionIndex(0).answer("a").build());

        // This question's answer is revealed - after grading, by design...
        assertEquals("CANARY-ANSWER", response.getCorrectAnswer());
        // ...but the embedded match state is the sanitised one, and later questions stay hidden.
        assertClean(response.getMatch(), "answerResponse.match");
    }

    @Test
    void newlyCreatedQueueAndInviteMatchesNeverExposeBankAnswers() throws Exception {
        when(matchRepository.findWaitingMatchesByUser(any())).thenReturn(List.of());
        for (String slug : List.of("dsa-master-quiz", "logic-puzzle", "number-detective", "code-breaker")) {
            MatchDto queued = matchService.queueForMatch(1L, slug, "EASY");
            JsonNode client = json.readTree(queued.getChallengeData());
            assertTrue(client.isArray() && client.size() > 0, slug);
            MatchChallengeTest.assertNoForbiddenKeys(client, slug + " queue");
        }

        when(friendshipRepository.findBetweenUsers(any(), any())).thenReturn(Optional.of(
                Friendship.builder().user(host).friend(guest).status(Friendship.Status.ACCEPTED).build()));
        when(matchRepository.findPendingInvitationsForUser(guest)).thenReturn(List.of());
        MatchDto invited = matchService.createFriendMatch(1L, 2L, "logic-puzzle", "EASY");
        MatchChallengeTest.assertNoForbiddenKeys(json.readTree(invited.getChallengeData()), "invite");
    }

    // ------------------------------------------------------------------ WebSocket payloads

    @Test
    void everyStompBroadcastAndUserEventIsClean() throws Exception {
        match("f1", Match.MatchMode.FRIEND, Match.MatchStatus.WAITING, host, guest);
        match("m3", Match.MatchMode.RANKED, Match.MatchStatus.READY, host, guest);

        matchService.acceptFriendMatch("f1", 2L);                       // MATCH_READY + INVITATION_ACCEPTED
        matchService.submitMatchAnswer("m3", 1L, MatchAnswerRequest.builder().questionIndex(0).answer("a").build());
        matchService.submitMatchAnswer("m3", 1L, MatchAnswerRequest.builder().questionIndex(1).answer("b").build());
        matchService.submitMatchAnswer("m3", 2L, MatchAnswerRequest.builder().questionIndex(0).answer("a").build());
        matchService.submitMatchAnswer("m3", 2L, MatchAnswerRequest.builder().questionIndex(1).answer("b").build()); // finishes the match
        matchService.cancelMatch("f1", 1L);

        ArgumentCaptor<Object> payloads = ArgumentCaptor.forClass(Object.class);
        verify(messagingTemplate, atLeastOnce()).convertAndSend(anyString(), payloads.capture());
        assertTrue(payloads.getAllValues().size() >= 4, "expected several events to inspect");
        for (Object payload : payloads.getAllValues()) {
            assertClean(payload, "stomp payload");
        }
    }

    // ------------------------------------------------------------------ fallback DB puzzles

    @Test
    void fallbackDbPuzzlesAreStoredWithAnswersButNeverSentToClients() throws Exception {
        Map<String, Object> dbPuzzle = new java.util.LinkedHashMap<>();
        dbPuzzle.put("id", 77);
        dbPuzzle.put("question", "From the DB");
        dbPuzzle.put("options", List.of("a", "b"));
        dbPuzzle.put("correctAnswer", "CANARY-ANSWER");
        dbPuzzle.put("explanation", "CANARY-EXPLANATION");
        when(gameService.getPuzzlesForMatch("db-only-game", "MEDIUM")).thenReturn(List.of(dbPuzzle));

        String stored = ReflectionTestUtils.invokeMethod(matchService, "generateChallengeData", "db-only-game", "MEDIUM");

        assertEquals("CANARY-ANSWER", MatchChallenge.correctAnswerOf(MatchChallenge.parse(stored).question(0)),
                "the server must keep the answer to be able to grade");
        String client = MatchChallenge.toClientJson(stored);
        assertFalse(client.contains("CANARY"));
        assertTrue(client.contains("From the DB"));
    }

    @Test
    void gameServiceBuildsInternalMatchPuzzlesFromEntitiesAndSkipsUngradableOnes() {
        PuzzleRepository puzzleRepository = mock(PuzzleRepository.class);
        GameService real = new GameService(mock(com.algoarena.repository.GameRepository.class), puzzleRepository,
                mock(com.algoarena.repository.GameAttemptRepository.class), mock(UserRepository.class),
                mock(UserService.class), new ObjectMapper());
        Puzzle good = Puzzle.builder().id(1L).title("Good").difficulty("EASY")
                .content("{\"question\":\"Q?\",\"options\":[\"a\",\"b\"]}")
                .correctAnswer("{\"answer\":\"a\"}").explanation("because").build();
        Puzzle noAnswer = Puzzle.builder().id(2L).title("Bad").difficulty("EASY")
                .content("{\"question\":\"Q?\"}").correctAnswer("{}").explanation("x").build();
        Puzzle brokenJson = Puzzle.builder().id(3L).title("Broken").difficulty("EASY")
                .content("{not json").correctAnswer("{\"answer\":\"a\"}").explanation("x").build();
        when(puzzleRepository.findRandomByGameSlugAndDifficulty("logic-puzzle", "EASY")).thenReturn(List.of(good, noAnswer, brokenJson));

        List<Map<String, Object>> result = real.getPuzzlesForMatch("logic-puzzle", "easy");

        assertEquals(1, result.size());
        assertEquals("a", result.get(0).get("correctAnswer"));
        assertEquals("because", result.get(0).get("explanation"));
        assertEquals("Q?", result.get(0).get("question"));
        // and the public PuzzleDto path remains answer-free (P0.2)
        assertFalse(new ArrayList<>(List.of(real.getPuzzlesByGame("logic-puzzle", "easy"))).toString().contains("because"));
    }
}
