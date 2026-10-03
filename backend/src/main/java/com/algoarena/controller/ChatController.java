package com.algoarena.controller;

import com.algoarena.dto.ChatMessageDto;
import com.algoarena.entity.User;
import com.algoarena.service.ChatService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/chat")
@RequiredArgsConstructor
public class ChatController {

    private final ChatService chatService;

    @GetMapping("/{friendUserId}")
    public ResponseEntity<List<ChatMessageDto>> getConversation(
            @PathVariable Long friendUserId,
            @AuthenticationPrincipal User user) {
        if (user == null) return ResponseEntity.status(401).build();
        return ResponseEntity.ok(chatService.getConversation(user.getId(), friendUserId));
    }

    @PostMapping("/{friendUserId}")
    public ResponseEntity<ChatMessageDto> sendMessage(
            @PathVariable Long friendUserId,
            @RequestBody Map<String, String> body,
            @AuthenticationPrincipal User user) {
        if (user == null) return ResponseEntity.status(401).build();
        String content = body.get("content");
        return ResponseEntity.ok(chatService.sendMessage(user.getId(), friendUserId, content));
    }
}
