package com.algoarena.dto;

import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class MysterySolveResponseDto {
    private Boolean correct;
    private Integer score;
    private Boolean correctCulprit;
    private Boolean correctMotive;
    private Integer evidenceMatches;
    private String solution;
    private UserDto user;
}
