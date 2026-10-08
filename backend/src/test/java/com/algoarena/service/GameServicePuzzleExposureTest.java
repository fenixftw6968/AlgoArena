package com.algoarena.service;

import com.algoarena.dto.AttemptRequest;
import com.algoarena.dto.AttemptResponse;
import com.algoarena.dto.PuzzleDto;
import com.algoarena.dto.UserDto;
import com.algoarena.entity.Game;
import com.algoarena.entity.Puzzle;
import com.algoarena.entity.User;
import com.algoarena.repository.GameAttemptRepository;
import com.algoarena.repository.GameRepository;
import com.algoarena.repository.PuzzleRepository;
import com.algoarena.repository.UserRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.lang.reflect.Field;
import java.util.Arrays;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class GameServicePuzzleExposureTest {

    private static final String SECRET_ANSWER = "TOP-SECRET-ANSWER-42";
    private static final String SECRET_EXPLANATION = "TOP-SECRET-EXPLANATION";

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Mock private GameRepository gameRepository;
    @Mock private PuzzleRepository puzzleRepository;
    @Mock private GameAttemptRepository gameAttemptRepository;
    @Mock private UserRepository userRepository;
    @Mock private UserService userService;

    private GameService gameService;
    private Puzzle puzzle;

    @BeforeEach
    void setUp() {
        gameService = new GameService(gameRepository, puzzleRepository, gameAttemptRepository,
                userRepository, userService, objectMapper);

        puzzle = Puzzle.builder()
                .id(7L)
                .title("Sequence")
                .difficulty("EASY")
                .content("{\"question\":\"2, 4, 8, ?\",\"options\":[\"10\",\"16\",\"12\",\"14\"],\"hint\":\"doubling\","
                        + "\"answer\":\"" + SECRET_ANSWER + "\",\"meta\":{\"solution\":\"" + SECRET_ANSWER + "\"}}")
                .correctAnswer("{\"answer\":\"" + SECRET_ANSWER + "\"}")
                .explanation(SECRET_EXPLANATION)
                .xpReward(25)
                .orderIndex(1)
                .build();
    }

    // ---------- GET puzzles exposure ----------

    @Test
    void puzzleDtoDeclaresNoAnswerOrExplanationProperty() {
        Set<String> fields = Arrays.stream(PuzzleDto.class.getDeclaredFields())
                .map(Field::getName).collect(Collectors.toSet());

        assertFalse(fields.contains("correctAnswer"));
        assertFalse(fields.contains("explanation"));
        assertTrue(fields.containsAll(Set.of("id", "title", "difficulty", "content", "xpReward", "orderIndex")));
    }

    @Test
    void listedPuzzlesNeverContainAnswerOrExplanationAnywhere() throws Exception {
        when(puzzleRepository.findRandomByGameSlug("logic-puzzle")).thenReturn(List.of(puzzle));

        List<PuzzleDto> result = gameService.getPuzzlesByGame("logic-puzzle", null);
        String serialised = objectMapper.writeValueAsString(result);

        assertEquals(1, result.size());
        assertFalse(serialised.contains(SECRET_ANSWER), "answer value leaked");
        assertFalse(serialised.contains(SECRET_EXPLANATION), "explanation leaked");
        assertFalse(serialised.contains("correctAnswer"));
        assertFalse(serialised.contains("explanation"));
    }

    @Test
    void listedPuzzlesKeepEverythingNeededToPlay() throws Exception {
        when(puzzleRepository.findRandomByGameSlugAndDifficulty("logic-puzzle", "EASY")).thenReturn(List.of(puzzle));

        PuzzleDto dto = gameService.getPuzzlesByGame("logic-puzzle", "easy").get(0);
        JsonNode content = objectMapper.readTree(dto.getContent());

        assertEquals(7L, dto.getId());
        assertEquals("Sequence", dto.getTitle());
        assertEquals("EASY", dto.getDifficulty());
        assertEquals(25, dto.getXpReward());
        assertEquals(1, dto.getOrderIndex());
        assertEquals("2, 4, 8, ?", content.get("question").asText());
        assertEquals(4, content.get("options").size());
        assertEquals("doubling", content.get("hint").asText());
        assertFalse(content.has("answer"));
        assertFalse(content.get("meta").has("solution"));
    }

    @Test
    void invalidContentJsonFailsClosed() {
        puzzle.setContent("{broken json " + SECRET_ANSWER);
        when(puzzleRepository.findRandomByGameSlug("logic-puzzle")).thenReturn(List.of(puzzle));

        PuzzleDto dto = gameService.getPuzzlesByGame("logic-puzzle", null).get(0);

        assertEquals("{}", dto.getContent());
    }

    // ---------- Regression: grading stays server-side and the reveal after grading stays ----------

    @Test
    void submitAttemptStillGradesOnServerAndRevealsAnswerAfterGrading() {
        User user = User.builder().id(1L).username("u").email("u@x.com").noHintGames(0).build();
        Game game = Game.builder().id(3L).slug("logic-puzzle").title("Logic").build();
        when(userRepository.findById(1L)).thenReturn(Optional.of(user));
        when(gameRepository.findBySlug("logic-puzzle")).thenReturn(Optional.of(game));
        when(puzzleRepository.findById(7L)).thenReturn(Optional.of(puzzle));
        when(userService.convertToDto(any())).thenReturn(UserDto.builder().id(1L).build());

        AttemptRequest request = AttemptRequest.builder()
                .puzzleId(7L).userAnswer(SECRET_ANSWER).hintUsed(false).timeTakenSeconds(5).build();
        AttemptResponse response = gameService.submitAttempt(1L, "logic-puzzle", request);

        assertTrue(response.getIsCorrect());
        assertEquals(SECRET_ANSWER, response.getCorrectAnswer());
        assertEquals(SECRET_EXPLANATION, response.getExplanation());
        assertEquals(25, response.getXpEarned());
        verify(userService).updateProgression(eq(user), eq(25), anyInt());
    }

    @Test
    void submitAttemptWithWrongAnswerForRealPuzzleEarnsNothing() {
        User user = User.builder().id(1L).username("u").email("u@x.com").noHintGames(0).build();
        Game game = Game.builder().id(3L).slug("logic-puzzle").title("Logic").build();
        when(userRepository.findById(1L)).thenReturn(Optional.of(user));
        when(gameRepository.findBySlug("logic-puzzle")).thenReturn(Optional.of(game));
        when(puzzleRepository.findById(7L)).thenReturn(Optional.of(puzzle));
        when(userService.convertToDto(any())).thenReturn(UserDto.builder().id(1L).build());

        AttemptRequest request = AttemptRequest.builder()
                .puzzleId(7L).userAnswer("wrong").hintUsed(false).timeTakenSeconds(5).build();
        AttemptResponse response = gameService.submitAttempt(1L, "logic-puzzle", request);

        assertFalse(response.getIsCorrect());
        assertEquals(0, response.getXpEarned());
        verify(userService, never()).updateProgression(any(), anyInt(), anyInt());
    }
}
