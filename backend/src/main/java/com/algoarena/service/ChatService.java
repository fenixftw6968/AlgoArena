package com.algoarena.service;

import com.algoarena.dto.ChatMessageDto;
import com.algoarena.entity.ChatMessage;
import com.algoarena.entity.User;
import com.algoarena.exception.BadRequestException;
import com.algoarena.exception.ResourceNotFoundException;
import com.algoarena.repository.ChatMessageRepository;
import com.algoarena.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class ChatService {

    private final ChatMessageRepository chatMessageRepository;
    private final UserRepository userRepository;

    @Transactional(readOnly = true)
    public List<ChatMessageDto> getConversation(Long currentUserId, Long friendUserId) {
        User u1 = userRepository.findById(currentUserId)
                .orElseThrow(() -> new ResourceNotFoundException("Current user not found"));
        User u2 = userRepository.findById(friendUserId)
                .orElseThrow(() -> new ResourceNotFoundException("Friend user not found"));

        return chatMessageRepository.findConversation(u1, u2).stream()
                .map(this::convertToDto)
                .toList();
    }

    @Transactional
    public ChatMessageDto sendMessage(Long senderId, Long receiverId, String content) {
        if (content == null || content.trim().isEmpty()) {
            throw new BadRequestException("Message cannot be empty");
        }

        User sender = userRepository.findById(senderId)
                .orElseThrow(() -> new ResourceNotFoundException("Sender not found"));
        User receiver = userRepository.findById(receiverId)
                .orElseThrow(() -> new ResourceNotFoundException("Receiver not found"));

        ChatMessage message = ChatMessage.builder()
                .sender(sender)
                .receiver(receiver)
                .content(content.trim())
                .isRead(false)
                .build();

        message = chatMessageRepository.save(message);
        return convertToDto(message);
    }

    public ChatMessageDto convertToDto(ChatMessage msg) {
        return ChatMessageDto.builder()
                .id(msg.getId())
                .senderId(msg.getSender().getId())
                .senderUsername(msg.getSender().getUsername())
                .receiverId(msg.getReceiver().getId())
                .receiverUsername(msg.getReceiver().getUsername())
                .content(msg.getContent())
                .isRead(msg.getIsRead())
                .createdAt(msg.getCreatedAt())
                .build();
    }
}
