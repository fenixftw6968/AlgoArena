package com.algoarena.dto;

import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class LeaderboardEntryDto {
    private Integer rank;
    private String username;
    private Integer level;
    private Integer xp;
    private Integer streak;
    private Integer competitiveRating;
    private String competitiveRank;
    private Integer matchesWon;
    private Integer matchesPlayed;
}
