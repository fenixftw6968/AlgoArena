package com.algoarena.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class MatchInviteRequest {

    @NotNull(message = "friendId is required")
    private Long friendId;

    @NotBlank(message = "gameSlug is required")
    @Size(max = 60, message = "gameSlug is too long")
    private String gameSlug;

    @Size(max = 20, message = "difficulty is too long")
    private String difficulty;
}
