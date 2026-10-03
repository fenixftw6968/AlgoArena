package com.algoarena.controller;

import com.algoarena.dto.LeaderboardEntryDto;
import com.algoarena.service.LeaderboardService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/leaderboard")
@RequiredArgsConstructor
public class LeaderboardController {

    private final LeaderboardService leaderboardService;

    @GetMapping
    public ResponseEntity<List<LeaderboardEntryDto>> getLeaderboard(
            @RequestParam(defaultValue = "xp") String sortBy) {
        return ResponseEntity.ok(leaderboardService.getLeaderboard(sortBy));
    }
}
