package com.algoarena.service;

import com.algoarena.dto.UserDto;
import com.algoarena.entity.DailyChallenge;
import com.algoarena.entity.User;
import com.algoarena.entity.UserDailyChallenge;
import com.algoarena.repository.DailyChallengeRepository;
import com.algoarena.repository.UserDailyChallengeRepository;
import com.algoarena.repository.UserRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.time.LocalDate;
import java.time.ZoneId;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class DailyChallengeServiceTest {

    private static final String PUZZLE_JSON = "{\"question\":\"Worst-case BST search?\","
            + "\"options\":[\"O(N)\",\"O(log N)\",\"O(N log N)\",\"O(1)\"],"
            + "\"answer\":\"O(N)\",\"correctAnswer\":\"O(N)\","
            + "\"explanation\":\"Degenerates into a linked list.\",\"hint\":\"Think linked list.\"}";

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Mock private DailyChallengeRepository dailyChallengeRepository;
    @Mock private UserDailyChallengeRepository userDailyChallengeRepository;
    @Mock private UserRepository userRepository;
    @Mock private UserService userService;

    private DailyChallengeService service;
    private DailyChallenge challenge;
    private User user;

    @BeforeEach
    void setUp() {
        service = new DailyChallengeService(dailyChallengeRepository, userDailyChallengeRepository,
                userRepository, userService, objectMapper);

        challenge = DailyChallenge.builder()
                .id(10L)
                .title("BST")
                .description("desc")
                .type("dsa-master-quiz")
                .difficulty("MEDIUM")
                .xpReward(100)
                .coinReward(50)
                .puzzle(PUZZLE_JSON)
                .challengeDate(LocalDate.now(ZoneId.of("Asia/Kolkata")))
                .build();
        user = User.builder().id(1L).username("tester").email("t@algoarena.com").build();

        when(dailyChallengeRepository.findByChallengeDate(any())).thenReturn(Optional.of(challenge));
        when(userRepository.findByIdForUpdate(1L)).thenReturn(Optional.of(user));
        when(userDailyChallengeRepository.findByUserIdAndDailyChallengeId(1L, 10L)).thenReturn(Optional.empty());
        when(userService.convertToDto(any())).thenReturn(UserDto.builder().id(1L).build());
    }

    // ---------- GET payload ----------

    @Test
    void todayChallengePuzzleNeverContainsAnswerFields() throws Exception {
        Map<String, Object> response = service.getTodayChallenge(1L);

        JsonNode puzzle = objectMapper.readTree((String) response.get("puzzle"));
        assertFalse(puzzle.has("answer"));
        assertFalse(puzzle.has("correctAnswer"));
        assertFalse(puzzle.has("explanation"));
        assertTrue(puzzle.has("question"));
        assertEquals(4, puzzle.get("options").size());
        assertTrue(puzzle.has("hint"));
    }

    @Test
    void todayChallengeDoesNotRevealAnswerBeforeAttempt() {
        Map<String, Object> response = service.getTodayChallenge(1L);

        assertEquals(false, response.get("attempted"));
        assertFalse(response.containsKey("correctAnswer"));
        assertFalse(response.containsKey("explanation"));
    }

    @Test
    void todayChallengeDoesNotRevealAnswerToAnonymousUser() {
        Map<String, Object> response = service.getTodayChallenge(null);

        assertFalse(response.containsKey("correctAnswer"));
        assertFalse(response.containsKey("explanation"));
    }

    @Test
    void todayChallengeRevealsAnswerOnlyAfterGradedAttempt() {
        when(userDailyChallengeRepository.findByUserIdAndDailyChallengeId(1L, 10L))
                .thenReturn(Optional.of(attempt(false, 0, 0)));

        Map<String, Object> response = service.getTodayChallenge(1L);

        assertEquals(true, response.get("attempted"));
        assertEquals("O(N)", response.get("correctAnswer"));
        assertEquals("Degenerates into a linked list.", response.get("explanation"));
    }

    @Test
    void sanitizerFailsClosedOnInvalidJson() {
        assertEquals("{}", service.sanitizePuzzleForClient("not json"));
    }

    // ---------- submitAnswer ----------

    @Test
    void firstCorrectAnswerAwardsRewardsExactlyOnce() {
        Map<String, Object> result = service.submitAnswer(1L, "O(N)");

        assertEquals(true, result.get("isCorrect"));
        assertEquals(false, result.get("alreadyAttempted"));
        assertEquals(100, result.get("xpEarned"));
        assertEquals(50, result.get("coinsEarned"));
        assertEquals("O(N)", result.get("correctAnswer"));
        verify(userService, times(1)).updateProgression(user, 100, 50);

        ArgumentCaptor<UserDailyChallenge> saved = ArgumentCaptor.forClass(UserDailyChallenge.class);
        verify(userDailyChallengeRepository).save(saved.capture());
        assertTrue(saved.getValue().getIsCorrect());
        assertEquals(100, saved.getValue().getXpEarned());
    }

    @Test
    void firstWrongAnswerEarnsNothingAndLocksTheDay() {
        Map<String, Object> result = service.submitAnswer(1L, "O(1)");

        assertEquals(false, result.get("isCorrect"));
        assertEquals(0, result.get("xpEarned"));
        verify(userService, never()).updateProgression(any(), anyInt(), anyInt());

        ArgumentCaptor<UserDailyChallenge> saved = ArgumentCaptor.forClass(UserDailyChallenge.class);
        verify(userDailyChallengeRepository).save(saved.capture());
        assertFalse(saved.getValue().getIsCorrect());
    }

    @Test
    void repeatSubmissionAfterCorrectAnswerEarnsNothingMore() {
        when(userDailyChallengeRepository.findByUserIdAndDailyChallengeId(1L, 10L))
                .thenReturn(Optional.of(attempt(true, 100, 50)));

        Map<String, Object> result = service.submitAnswer(1L, "O(N)");

        assertEquals(true, result.get("alreadyAttempted"));
        assertEquals(true, result.get("isCorrect"));
        verify(userService, never()).updateProgression(any(), anyInt(), anyInt());
        verify(userDailyChallengeRepository, never()).save(any());
        verify(userRepository, never()).save(any());
    }

    @Test
    void wrongFirstAttemptCannotBeRetriedWithCorrectAnswer() {
        when(userDailyChallengeRepository.findByUserIdAndDailyChallengeId(1L, 10L))
                .thenReturn(Optional.of(attempt(false, 0, 0)));

        Map<String, Object> result = service.submitAnswer(1L, "O(N)");

        assertEquals(true, result.get("alreadyAttempted"));
        assertEquals(false, result.get("isCorrect"));
        assertEquals(0, result.get("xpEarned"));
        verify(userService, never()).updateProgression(any(), anyInt(), anyInt());
        verify(userDailyChallengeRepository, never()).save(any());
    }

    @Test
    void submissionTakesRowLockOnUserToSerialiseConcurrentRequests() {
        service.submitAnswer(1L, "O(N)");

        verify(userRepository).findByIdForUpdate(1L);
        verify(userRepository, never()).findById(any());
    }

    private UserDailyChallenge attempt(boolean correct, int xp, int coins) {
        return UserDailyChallenge.builder()
                .user(user).dailyChallenge(challenge)
                .isCorrect(correct).xpEarned(xp).coinsEarned(coins)
                .build();
    }
}
