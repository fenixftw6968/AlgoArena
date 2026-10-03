package com.algoarena.controller;

import com.algoarena.dto.QuestionHistoryDto;
import com.algoarena.entity.User;
import com.algoarena.service.QuestionHistoryService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@Slf4j
@RestController
@RequestMapping("/api/question-history")
@RequiredArgsConstructor
public class QuestionHistoryController {

    private final QuestionHistoryService questionHistoryService;

    @PostMapping("/select")
    public ResponseEntity<QuestionHistoryDto.SelectionResponse> selectQuestions(
            @AuthenticationPrincipal User user,
            @RequestBody QuestionHistoryDto.SelectionRequest request) {
        if (user == null) {
            return ResponseEntity.status(401).build();
        }
        return ResponseEntity.ok(questionHistoryService.selectAndReserveQuestions(user.getId(), request));
    }

    @GetMapping
    public ResponseEntity<QuestionHistoryDto.HistoryResponse> getHistory(
            @AuthenticationPrincipal User user,
            @RequestParam String gameSlug,
            @RequestParam(required = false, defaultValue = "ALL") String difficulty) {
        if (user == null) {
            return ResponseEntity.status(401).build();
        }
        return ResponseEntity.ok(questionHistoryService.getQuestionHistory(user.getId(), gameSlug, difficulty));
    }

    @PostMapping("/record")
    public ResponseEntity<Void> recordQuestions(
            @AuthenticationPrincipal User user,
            @RequestBody QuestionHistoryDto.RecordRequest request) {
        if (user == null) {
            return ResponseEntity.status(401).build();
        }
        questionHistoryService.recordUsedQuestions(user.getId(), request);
        return ResponseEntity.ok().build();
    }

    @DeleteMapping("/reset")
    public ResponseEntity<Void> resetHistory(
            @AuthenticationPrincipal User user,
            @RequestParam String gameSlug,
            @RequestParam(required = false, defaultValue = "ALL") String difficulty) {
        if (user == null) {
            return ResponseEntity.status(401).build();
        }
        questionHistoryService.resetHistory(user.getId(), gameSlug, difficulty);
        return ResponseEntity.noContent().build();
    }
}
