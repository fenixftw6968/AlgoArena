package com.algoarena.controller;

import com.algoarena.dto.MysterySolveRequest;
import com.algoarena.dto.MysterySolveResponseDto;
import com.algoarena.entity.MysteryCase;
import com.algoarena.entity.User;
import com.algoarena.service.MysteryCaseService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/mystery")
@RequiredArgsConstructor
public class MysteryCaseController {

    private final MysteryCaseService mysteryCaseService;

    @GetMapping
    public ResponseEntity<List<MysteryCase>> getAllCases() {
        return ResponseEntity.ok(mysteryCaseService.getAllCases());
    }

    @GetMapping("/{id}")
    public ResponseEntity<MysteryCase> getCaseById(@PathVariable Long id) {
        return ResponseEntity.ok(mysteryCaseService.getCaseById(id));
    }

    @PostMapping("/{id}/solve")
    public ResponseEntity<MysterySolveResponseDto> solveCase(
            @PathVariable Long id,
            @RequestBody MysterySolveRequest request,
            @AuthenticationPrincipal User user) {
        if (user == null) {
            return ResponseEntity.status(401).build();
        }
        return ResponseEntity.ok(mysteryCaseService.solveCase(user.getId(), id, request));
    }
}
