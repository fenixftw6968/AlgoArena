package com.algoarena.dto;

import lombok.*;
import java.util.List;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class MysterySolveRequest {
    private String culprit;
    private String motive;
    private List<String> keyEvidence;
}
