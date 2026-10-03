package com.algoarena.service;

import com.algoarena.dto.QuestionHistoryDto;
import com.algoarena.entity.User;
import com.algoarena.entity.UserQuestionHistory;
import com.algoarena.repository.UserQuestionHistoryRepository;
import com.algoarena.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
public class QuestionHistoryServiceTest {

    @Mock
    private UserQuestionHistoryRepository questionHistoryRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private org.springframework.jdbc.core.JdbcTemplate jdbcTemplate;

    @InjectMocks
    private QuestionHistoryService questionHistoryService;

    private User mockUser;

    @BeforeEach
    void setUp() {
        mockUser = User.builder()
                .id(1L)
                .username("testcoder")
                .email("test@algoarena.com")
                .build();
    }

    @Test
    void testSelectQuestionsExcludesPreviouslyUsedOnAnotherDevice() {
        when(userRepository.findById(1L)).thenReturn(Optional.of(mockUser));

        // Suppose Computer A already played Q001, Q004, Q007
        List<String> usedOnComputerA = List.of("Q001", "Q004", "Q007");
        when(questionHistoryRepository.findUsedQuestionIds(1L, "dsa-master-quiz", "EASY"))
                .thenReturn(usedOnComputerA);

        List<String> pool = List.of("Q001", "Q002", "Q003", "Q004", "Q005", "Q006", "Q007", "Q008");

        QuestionHistoryDto.SelectionRequest request = QuestionHistoryDto.SelectionRequest.builder()
                .gameSlug("dsa-master-quiz")
                .difficulty("EASY")
                .candidateIds(pool)
                .count(3)
                .build();

        // Computer B requests questions
        QuestionHistoryDto.SelectionResponse response = questionHistoryService.selectAndReserveQuestions(1L, request);

        assertNotNull(response);
        assertEquals(3, response.getSelectedIds().size());
        assertFalse(response.isCycleReset());

        // Ensure none of Q001, Q004, Q007 were served to Computer B
        for (String selectedId : response.getSelectedIds()) {
            assertFalse(usedOnComputerA.contains(selectedId), "Selected question should exclude used questions: " + selectedId);
        }

        // Verify that the newly selected questions were saved to database via batch update
        verify(jdbcTemplate, times(1)).batchUpdate(anyString(), any(org.springframework.jdbc.core.BatchPreparedStatementSetter.class));
    }

    @Test
    void testCycleResetWhenPoolExhausted() {
        when(userRepository.findById(1L)).thenReturn(Optional.of(mockUser));

        // 4 out of 5 questions already used
        List<String> used = List.of("Q1", "Q2", "Q3", "Q4");
        when(questionHistoryRepository.findUsedQuestionIds(1L, "dsa-master-quiz", "EASY"))
                .thenReturn(used);

        List<String> pool = List.of("Q1", "Q2", "Q3", "Q4", "Q5");

        QuestionHistoryDto.SelectionRequest request = QuestionHistoryDto.SelectionRequest.builder()
                .gameSlug("dsa-master-quiz")
                .difficulty("EASY")
                .candidateIds(pool)
                .count(3) // requested 3, but only 1 unused remains
                .build();

        QuestionHistoryDto.SelectionResponse response = questionHistoryService.selectAndReserveQuestions(1L, request);

        assertTrue(response.isCycleReset(), "Cycle should reset when unplayed pool is smaller than requested count");
        assertEquals(3, response.getSelectedIds().size());

        // Verify that existing history was wiped for this game and difficulty
        verify(questionHistoryRepository, times(1)).deleteByUserIdAndGameSlugAndDifficulty(1L, "dsa-master-quiz", "EASY");
        verify(jdbcTemplate, times(1)).batchUpdate(anyString(), any(org.springframework.jdbc.core.BatchPreparedStatementSetter.class));
    }

    @Test
    void testDifficultyIsolation() {
        when(userRepository.findById(1L)).thenReturn(Optional.of(mockUser));

        // When checking HARD difficulty, history for EASY is not returned
        when(questionHistoryRepository.findUsedQuestionIds(1L, "dsa-master-quiz", "HARD"))
                .thenReturn(List.of());

        List<String> hardPool = List.of("Q_HARD_1", "Q_HARD_2", "Q_HARD_3");

        QuestionHistoryDto.SelectionRequest request = QuestionHistoryDto.SelectionRequest.builder()
                .gameSlug("dsa-master-quiz")
                .difficulty("HARD")
                .candidateIds(hardPool)
                .count(2)
                .build();

        QuestionHistoryDto.SelectionResponse response = questionHistoryService.selectAndReserveQuestions(1L, request);

        assertEquals(2, response.getSelectedIds().size());
        assertEquals("HARD", response.getDifficulty());
    }
}
