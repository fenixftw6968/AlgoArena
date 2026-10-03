package com.algoarena.dto;

import lombok.*;
import java.util.List;
import java.util.Map;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class GameDto {
    private Long id;
    private String slug;
    private String title;
    private String description;
    private String category;
    private String icon;
    private String difficulty;
    private Map<String, Integer> xpReward;
    private Integer totalPlayers;
    private Integer completionRate;
    private Boolean isUnlocked;
    private Boolean isNew;
    private Boolean isFeatured;
    private List<String> tags;
    private String estimatedTime;
}
