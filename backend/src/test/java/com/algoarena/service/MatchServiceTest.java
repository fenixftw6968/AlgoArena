package com.algoarena.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.algoarena.dto.MatchDto;
import com.algoarena.dto.MatchSubmitRequest;
import com.algoarena.entity.Match;
import com.algoarena.entity.User;
import com.algoarena.repository.FriendshipRepository;
import com.algoarena.repository.MatchRepository;
import com.algoarena.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.transaction.support.TransactionCallback;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.LocalDateTime;
import java.util.Collections;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
public class MatchServiceTest {

    @Mock
    private MatchRepository matchRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private FriendshipRepository friendshipRepository;

    @Spy
    private EloRatingService eloRatingService = new EloRatingService();

    @Mock
    private GameService gameService;

    @Spy
    private ObjectMapper objectMapper = new ObjectMapper();

    @Mock
    private SimpMessagingTemplate messagingTemplate;

    @Mock
    private TransactionTemplate transactionTemplate;

    @InjectMocks
    private MatchService matchService;

    private User player1;
    private User player2;

    @BeforeEach
    void setUp() {
        player1 = User.builder()
                .id(1L)
                .username("Alice")
                .competitiveRating(500)
                .matchesWon(0)
                .matchesPlayed(0)
                .build();

        player2 = User.builder()
                .id(2L)
                .username("Bob")
                .competitiveRating(1500) // Drastically different rating
                .matchesWon(0)
                .matchesPlayed(0)
                .build();
    }

    @Test
    void testRankedMatchmakingPairsTwoOnlinePlayersRegardlessOfRating() {
        // The service runs the queue/claim flow inside a transaction; the mock runs it inline.
        when(transactionTemplate.execute(any())).thenAnswer(invocation ->
                ((TransactionCallback<Object>) invocation.getArgument(0)).doInTransaction(null));

        when(userRepository.findById(1L)).thenReturn(Optional.of(player1));
        when(userRepository.findById(2L)).thenReturn(Optional.of(player2));

        // When Player 1 queues: no previous waiting matches, no open matches
        when(matchRepository.findWaitingMatchesByUser(player1)).thenReturn(Collections.emptyList());

        when(matchRepository.save(any(Match.class))).thenAnswer(invocation -> {
            Match m = invocation.getArgument(0);
            if (m.getId() == null) {
                m.setId("match-uuid-1");
                m.setCreatedAt(LocalDateTime.now());
            }
            return m;
        });

        // Player 1 queues
        MatchDto p1Dto = matchService.queueForMatch(1L, "number-detective", "MEDIUM");
        assertNotNull(p1Dto);
        assertEquals("WAITING", p1Dto.getStatus());
        assertEquals(1L, p1Dto.getPlayer1Id());
        assertNull(p1Dto.getPlayer2Id());

        // Now Player 2 queues for the same game
        Match waitingMatch = Match.builder()
                .id("match-uuid-1")
                .gameSlug("number-detective")
                .difficulty("MEDIUM")
                .mode(Match.MatchMode.RANKED)
                .status(Match.MatchStatus.WAITING)
                .player1(player1)
                .player1Ready(true)
                .player1RatingBefore(500)
                .createdAt(LocalDateTime.now())
                .build();

        when(matchRepository.findWaitingMatchesByUser(player2)).thenReturn(Collections.emptyList());
        // Player 2 finds Player 1's open slot and claims it
        when(matchRepository.findAndLockWaitingRankedMatch(eq("number-detective"), eq(2L), any(LocalDateTime.class)))
                .thenReturn(Optional.of(waitingMatch));

        MatchDto p2Dto = matchService.queueForMatch(2L, "number-detective", "MEDIUM");

        // Player 2 must be matched on the SAME match!
        assertNotNull(p2Dto);
        assertEquals("match-uuid-1", p2Dto.getId());
        assertEquals("READY", p2Dto.getStatus());
        assertEquals(1L, p2Dto.getPlayer1Id());
        assertEquals(2L, p2Dto.getPlayer2Id());
        assertTrue(p2Dto.getPlayer1Ready());
        assertTrue(p2Dto.getPlayer2Ready());

        // WebSocket MATCH_READY event must be broadcast to the match topic
        verify(messagingTemplate).convertAndSend(eq("/topic/match/match-uuid-1"), any(Object.class));
    }

    @Test
    void testRatingUpdatesByExact25OnWinAndLoss() {
        Match match = Match.builder()
                .id("match-123")
                .gameSlug("number-detective")
                .difficulty("MEDIUM")
                .mode(Match.MatchMode.RANKED)
                .status(Match.MatchStatus.READY)
                .player1(player1)
                .player2(player2)
                .player1RatingBefore(500)
                .player2RatingBefore(1500)
                .player1Ready(true)
                .player2Ready(true)
                .player1Score(5)
                .player1TimeSeconds(30)
                .player1Mistakes(0)
                .player1Finished(true)
                .build();

        when(matchRepository.findByIdWithLock("match-123")).thenReturn(Optional.of(match));
        when(matchRepository.save(any(Match.class))).thenAnswer(inv -> inv.getArgument(0));

        // Player 2 submits lower score (Player 1 wins, Player 2 loses)
        MatchSubmitRequest request = new MatchSubmitRequest();
        request.setScore(3);
        request.setTimeTakenSeconds(45);
        request.setMistakes(2);

        MatchDto result = matchService.submitMatchResult("match-123", 2L, request);

        assertEquals("FINISHED", result.getStatus());
        assertEquals(1L, result.getWinnerId());

        // Winner (Player 1) increases by 25: 500 -> 525
        assertEquals(25, result.getPlayer1RatingChange());
        assertEquals(525, player1.getCompetitiveRating());
        assertEquals(1, player1.getMatchesWon());

        // Loser (Player 2) decreases by 25: 1500 -> 1475
        assertEquals(-25, result.getPlayer2RatingChange());
        assertEquals(1475, player2.getCompetitiveRating());
        assertEquals(0, player2.getMatchesWon());

        verify(userRepository).save(player1);
        verify(userRepository).save(player2);
    }
}
