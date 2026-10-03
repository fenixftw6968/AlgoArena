package com.algoarena.dto;

import lombok.*;

import java.time.LocalDateTime;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class FriendDto {
    private Long id;
    private Long userId;
    private String username;
    private Integer level;
    private Integer competitiveRating;
    private String competitiveRank;
    private String status; // PENDING_INCOMING, PENDING_OUTGOING, ACCEPTED
    private Boolean isOnline;
    private LocalDateTime connectedAt;
}
