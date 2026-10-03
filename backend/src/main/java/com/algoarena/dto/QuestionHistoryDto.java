package com.algoarena.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.ArrayList;
import java.util.List;

public class QuestionHistoryDto {

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class SelectionRequest {
        private String gameSlug;
        @Builder.Default
        private String difficulty = "ALL";
        @Builder.Default
        private List<String> candidateIds = new ArrayList<>();
        @Builder.Default
        private Integer count = 10;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class SelectionResponse {
        private String gameSlug;
        private String difficulty;
        private List<String> selectedIds;
        private boolean cycleReset;
        private int totalUsed;
        private int poolSize;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class RecordRequest {
        private String gameSlug;
        @Builder.Default
        private String difficulty = "ALL";
        @Builder.Default
        private List<String> questionIds = new ArrayList<>();
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class HistoryResponse {
        private String gameSlug;
        private String difficulty;
        private List<String> usedQuestionIds;
        private int totalUsed;
    }
}
