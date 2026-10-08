package com.algoarena.controller;

import com.algoarena.config.SecurityConfig;
import com.algoarena.entity.Puzzle;
import com.algoarena.repository.GameAttemptRepository;
import com.algoarena.repository.GameRepository;
import com.algoarena.repository.PuzzleRepository;
import com.algoarena.repository.UserRepository;
import com.algoarena.security.JwtAuthFilter;
import com.algoarena.security.JwtUtil;
import com.algoarena.service.GameService;
import com.algoarena.service.UserService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * End-to-end check (controller + real GameService + real security rules, mocked persistence) that
 * the public puzzles endpoint never returns answer data.
 */
@WebMvcTest(GameController.class)
@Import({SecurityConfig.class, JwtAuthFilter.class, GameService.class})
@TestPropertySource(properties = "cors.allowed-origins=http://localhost:5173")
class GamePuzzlesEndpointSecurityTest {

    private static final String SECRET_ANSWER = "LEAK-CANARY-ANSWER";
    private static final String SECRET_EXPLANATION = "LEAK-CANARY-EXPLANATION";

    @Autowired private MockMvc mockMvc;

    @MockBean private GameRepository gameRepository;
    @MockBean private PuzzleRepository puzzleRepository;
    @MockBean private GameAttemptRepository gameAttemptRepository;
    @MockBean private UserRepository userRepository;
    @MockBean private UserService userService;
    @MockBean private JwtUtil jwtUtil;

    @BeforeEach
    void setUp() {
        Puzzle puzzle = Puzzle.builder()
                .id(1L)
                .title("Canary")
                .difficulty("MEDIUM")
                .content("{\"question\":\"Pick one\",\"options\":[\"a\",\"b\",\"c\",\"d\"],"
                        + "\"correctAnswer\":\"" + SECRET_ANSWER + "\"}")
                .correctAnswer("{\"answer\":\"" + SECRET_ANSWER + "\"}")
                .explanation(SECRET_EXPLANATION)
                .xpReward(30)
                .orderIndex(0)
                .build();
        when(puzzleRepository.findRandomByGameSlug("dsa-master-quiz")).thenReturn(List.of(puzzle));
        when(puzzleRepository.findRandomByGameSlugAndDifficulty("dsa-master-quiz", "MEDIUM")).thenReturn(List.of(puzzle));
    }

    @Test
    void anonymousUserGetsPlayablePuzzlesWithoutAnswers() throws Exception {
        MvcResult result = mockMvc.perform(get("/api/games/dsa-master-quiz/puzzles"))
                .andExpect(status().isOk())
                .andReturn();

        assertNoLeak(result.getResponse().getContentAsString());
    }

    @Test
    void difficultyFilteredRequestAlsoHasNoAnswers() throws Exception {
        MvcResult result = mockMvc.perform(get("/api/games/dsa-master-quiz/puzzles").param("difficulty", "medium"))
                .andExpect(status().isOk())
                .andReturn();

        assertNoLeak(result.getResponse().getContentAsString());
    }

    private static void assertNoLeak(String body) {
        assertTrue(body.contains("Pick one"), "question text must still be delivered");
        assertTrue(body.contains("Canary"), "title must still be delivered");
        assertFalse(body.contains(SECRET_ANSWER), "answer value leaked");
        assertFalse(body.contains(SECRET_EXPLANATION), "explanation leaked");
        assertFalse(body.contains("correctAnswer"), "correctAnswer key leaked");
        assertFalse(body.contains("explanation"), "explanation key leaked");
    }
}
