package com.algoarena.dto;

import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class GoogleAuthRequest {
    private String idToken;
    private String email;
    private String name;
    private String googleId;
}

