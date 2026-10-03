package com.algoarena.controller;

import com.algoarena.dto.MatchDto;
import com.algoarena.dto.MatchSubmitRequest;
import com.algoarena.entity.User;
import com.algoarena.service.MatchService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/matches")
@RequiredArgsConstructor
public class MatchController {

    private final MatchService matchService;

    @PostMapping("/queue")
    public ResponseEntity<MatchDto> queueForMatch(
            @RequestParam String gameSlug,
            @RequestParam(required = false) String difficulty,
            @AuthenticationPrincipal User user) {
        if (user == null) return ResponseEntity.status(401).build();
        return ResponseEntity.ok(matchService.queueForMatch(user.getId(), gameSlug, difficulty));
    }

    @PostMapping("/queue/cancel")
    public ResponseEntity<Void> cancelQueue(
            @RequestParam String gameSlug,
            @AuthenticationPrincipal User user) {
        if (user == null) return ResponseEntity.status(401).build();
        matchService.cancelQueue(user.getId(), gameSlug);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/invite")
    public ResponseEntity<MatchDto> inviteFriend(
            @RequestBody Map<String, Object> body,
            @AuthenticationPrincipal User user) {
        if (user == null) return ResponseEntity.status(401).build();
        Long friendId = Long.valueOf(body.get("friendId").toString());
        String gameSlug = (String) body.get("gameSlug");
        String difficulty = (String) body.get("difficulty");
        return ResponseEntity.ok(matchService.createFriendMatch(user.getId(), friendId, gameSlug, difficulty));
    }

    @GetMapping("/invitations/pending")
    public ResponseEntity<List<MatchDto>> getPendingInvitations(
            @AuthenticationPrincipal User user) {
        if (user == null) return ResponseEntity.status(401).build();
        return ResponseEntity.ok(matchService.getPendingInvitations(user.getId()));
    }

    @PostMapping("/{matchId}/accept")
    public ResponseEntity<MatchDto> acceptFriendMatch(
            @PathVariable String matchId,
            @AuthenticationPrincipal User user) {
        if (user == null) return ResponseEntity.status(401).build();
        return ResponseEntity.ok(matchService.acceptFriendMatch(matchId, user.getId()));
    }

    @PostMapping("/{matchId}/decline")
    public ResponseEntity<MatchDto> declineFriendMatch(
            @PathVariable String matchId,
            @AuthenticationPrincipal User user) {
        if (user == null) return ResponseEntity.status(401).build();
        return ResponseEntity.ok(matchService.declineFriendMatch(matchId, user.getId()));
    }

    @PostMapping("/{matchId}/cancel")
    public ResponseEntity<MatchDto> cancelMatch(
            @PathVariable String matchId,
            @AuthenticationPrincipal User user) {
        if (user == null) return ResponseEntity.status(401).build();
        return ResponseEntity.ok(matchService.cancelMatch(matchId, user.getId()));
    }

    @PostMapping("/{matchId}/abandon")
    public ResponseEntity<MatchDto> abandonMatch(
            @PathVariable String matchId,
            @AuthenticationPrincipal User user) {
        if (user == null) return ResponseEntity.status(401).build();
        return ResponseEntity.ok(matchService.abandonMatch(matchId, user.getId()));
    }

    @PostMapping("/{matchId}/connect-bot")
    public ResponseEntity<MatchDto> connectBotMatch(
            @PathVariable String matchId,
            @AuthenticationPrincipal User user) {
        if (user == null) return ResponseEntity.status(401).build();
        return ResponseEntity.ok(matchService.connectBotMatch(matchId, user.getId()));
    }

    @GetMapping("/{matchId}")
    public ResponseEntity<MatchDto> getMatchStatus(
            @PathVariable String matchId,
            @AuthenticationPrincipal User user) {
        if (user == null) return ResponseEntity.status(401).build();
        return ResponseEntity.ok(matchService.getMatchStatus(matchId));
    }

    @PostMapping("/{matchId}/submit")
    public ResponseEntity<MatchDto> submitMatch(
            @PathVariable String matchId,
            @RequestBody MatchSubmitRequest request,
            @AuthenticationPrincipal User user) {
        if (user == null) return ResponseEntity.status(401).build();
        return ResponseEntity.ok(matchService.submitMatchResult(matchId, user.getId(), request));
    }

    @GetMapping("/active")
    public ResponseEntity<MatchDto> getActiveMatch(
            @RequestParam String gameSlug,
            @AuthenticationPrincipal User user) {
        if (user == null) return ResponseEntity.status(401).build();
        MatchDto activeMatch = matchService.getActiveMatch(user.getId(), gameSlug);
        if (activeMatch == null) {
            return ResponseEntity.noContent().build();
        }
        return ResponseEntity.ok(activeMatch);
    }

    @GetMapping("/recent")
    public ResponseEntity<List<MatchDto>> getRecentMatches(
            @AuthenticationPrincipal User user) {
        if (user == null) return ResponseEntity.status(401).build();
        return ResponseEntity.ok(matchService.getRecentMatches(user.getId()));
    }
}
