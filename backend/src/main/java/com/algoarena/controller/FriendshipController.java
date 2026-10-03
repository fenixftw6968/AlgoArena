package com.algoarena.controller;

import com.algoarena.dto.FriendDto;
import com.algoarena.entity.User;
import com.algoarena.service.FriendshipService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/friends")
@RequiredArgsConstructor
public class FriendshipController {

    private final FriendshipService friendshipService;

    @GetMapping
    public ResponseEntity<List<FriendDto>> getFriends(@AuthenticationPrincipal User user) {
        if (user == null) return ResponseEntity.status(401).build();
        return ResponseEntity.ok(friendshipService.getFriends(user.getId()));
    }

    @GetMapping("/recommendations")
    public ResponseEntity<List<FriendDto>> getRecommendedUsers(
            @RequestParam(defaultValue = "6") int limit,
            @AuthenticationPrincipal User user) {
        if (user == null) return ResponseEntity.status(401).build();
        return ResponseEntity.ok(friendshipService.getRecommendedUsers(user.getId(), limit));
    }

    @PostMapping("/request")
    public ResponseEntity<FriendDto> sendFriendRequest(
            @RequestBody Map<String, String> body,
            @AuthenticationPrincipal User user) {
        if (user == null) return ResponseEntity.status(401).build();
        String targetUsername = body.get("username");
        return ResponseEntity.ok(friendshipService.sendFriendRequest(user.getId(), targetUsername));
    }

    @PostMapping("/respond")
    public ResponseEntity<Void> respondToRequest(
            @RequestBody Map<String, Object> body,
            @AuthenticationPrincipal User user) {
        if (user == null) return ResponseEntity.status(401).build();
        Long friendshipId = Long.valueOf(body.get("friendshipId").toString());
        boolean accept = Boolean.parseBoolean(body.get("accept").toString());
        friendshipService.respondToRequest(user.getId(), friendshipId, accept);
        return ResponseEntity.ok().build();
    }

    @DeleteMapping("/{friendshipId}")
    public ResponseEntity<Void> removeFriend(
            @PathVariable Long friendshipId,
            @AuthenticationPrincipal User user) {
        if (user == null) return ResponseEntity.status(401).build();
        friendshipService.removeFriend(user.getId(), friendshipId);
        return ResponseEntity.ok().build();
    }
}
