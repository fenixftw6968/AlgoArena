package com.algoarena.service;

import com.algoarena.dto.MatchAnswerRequest;
import com.algoarena.dto.MatchAnswerResponse;
import com.algoarena.dto.MatchDto;
import com.algoarena.entity.Match;
import com.algoarena.entity.User;
import com.algoarena.repository.FriendshipRepository;
import com.algoarena.repository.MatchRepository;
import com.algoarena.repository.UserRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
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
import java.util.Optional;
import java.util.concurrent.atomic.AtomicReference;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

/**
 * "Existing gameplay still works": a complete 1v1 ranked match, for every game that has a question
 * bank, played the way the frontend now plays it - queue, pair, receive the CLIENT-SAFE questions,
 * answer each one through the server, finish, and get the server-computed result.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class MatchFullFlowTest {

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

    private User alice;
    private User bob;

    @BeforeEach
    void setUp() {
        alice = User.builder().id(1L).username("alice").email("a@x.com").competitiveRating(500).matchesPlayed(0).matchesWon(0).build();
        bob = User.builder().id(2L).username("bob").email("b@x.com").competitiveRating(500).matchesPlayed(0).matchesWon(0).build();
        when(userRepository.findById(1L)).thenReturn(Optional.of(alice));
        when(userRepository.findById(2L)).thenReturn(Optional.of(bob));
        when(transactionTemplate.execute(any())).thenAnswer(inv ->
                ((TransactionCallback<Object>) inv.getArgument(0)).doInTransaction(null));
    }

    @ParameterizedTest
    @ValueSource(strings = {"dsa-master-quiz", "logic-puzzle", "number-detective", "code-breaker"})
    void aFullRankedMatchCanBePlayedAndIsScoredByTheServer(String slug) throws Exception {
        AtomicReference<Match> stored = new AtomicReference<>();
        when(matchRepository.save(any(Match.class))).thenAnswer(inv -> {
            Match m = inv.getArgument(0);
            if (m.getId() == null) {
                m.setId("flow-" + slug);
                m.setCreatedAt(LocalDateTime.now());
            }
            stored.set(m);
            return m;
        });

        // 1. Alice queues -> waiting; Bob queues -> paired (READY)
        MatchDto waiting = matchService.queueForMatch(1L, slug, "EASY");
        assertEquals("WAITING", waiting.getStatus());
        Match match = stored.get();
        when(matchRepository.findAndLockWaitingRankedMatch(eq(slug), eq(2L), any())).thenReturn(Optional.of(match));
        MatchDto ready = matchService.queueForMatch(2L, slug, "EASY");
        assertEquals("READY", ready.getStatus());
        assertEquals(match.getId(), ready.getId());

        // the countdown elapses
        match.setStartedAt(LocalDateTime.now().minusSeconds(5));
        when(matchRepository.findById(match.getId())).thenReturn(Optional.of(match));
        when(matchRepository.findByIdWithLock(match.getId())).thenReturn(Optional.of(match));

        // 2. Both players receive the same, playable, answer-free questions
        JsonNode clientQuestions = json.readTree(ready.getChallengeData());
        assertTrue(clientQuestions.isArray() && clientQuestions.size() > 0, slug + " has questions");
        MatchChallengeTest.assertNoForbiddenKeys(clientQuestions, slug);
        assertEquals(clientQuestions.size(), ready.getTotalQuestions());

        // 3. Alice answers every question correctly, Bob answers every question wrongly
        MatchChallenge serverCopy = MatchChallenge.parse(match.getChallengeData());
        for (int i = 0; i < serverCopy.questionCount(); i++) {
            String right = MatchChallenge.correctAnswerOf(serverCopy.question(i));

            MatchAnswerResponse a = matchService.submitMatchAnswer(match.getId(), 1L,
                    MatchAnswerRequest.builder().questionIndex(i).answer(right).build());
            MatchAnswerResponse b = matchService.submitMatchAnswer(match.getId(), 2L,
                    MatchAnswerRequest.builder().questionIndex(i).answer("definitely-wrong").build());

            assertTrue(a.isCorrect(), slug + " Q" + i + " honest answer must be graded correct");
            assertFalse(b.isCorrect(), slug + " Q" + i);
            assertEquals(i + 1, a.getAnsweredCount());
            assertEquals(i == serverCopy.questionCount() - 1, a.isFinished());
        }

        // 4. The server produced the final result and the rating change
        assertEquals(Match.MatchStatus.FINISHED, match.getStatus());
        assertEquals(1L, match.getWinnerId());
        assertEquals(serverCopy.questionCount(), match.getPlayer1Score());
        assertEquals(0, match.getPlayer2Score());
        assertEquals(525, alice.getCompetitiveRating());
        assertEquals(475, bob.getCompetitiveRating());

        // 5. Reconnect view: the finished player's progress comes from the server
        MatchDto asAlice = matchService.getMatchStatus(match.getId(), 1L);
        assertEquals(serverCopy.questionCount(), asAlice.getViewerAnsweredCount());
        assertEquals(serverCopy.questionCount(), asAlice.getViewerCorrectCount());
        MatchChallengeTest.assertNoForbiddenKeys(json.readTree(asAlice.getChallengeData()), slug + " after finish");
    }
}
