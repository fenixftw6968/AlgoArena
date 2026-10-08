package com.algoarena.competition.web;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

import java.time.Instant;
import java.util.List;

/**
 * Every shape the competition API sends or receives. Records only; deliberately NO field in this file can carry
 * a correct option, correct index or explanation before the competition is finished:
 * {@link ReviewItemDto} is the only type with those, and it is produced solely for a FINISHED competition and
 * only for the requesting participant's own answers.
 */
public final class CompetitionDtos {

    private CompetitionDtos() {
    }

    // ------------------------------------------------------------------ lobby / state

    /** Roster entry. No user id and no e-mail: just what is shown in the lobby. */
    public record PlayerDto(String username, int level, boolean host, boolean you, String status) {
    }

    /** One of the caller's own recorded answers (verdict only - never the correct option). */
    public record AnswerDto(int questionNumber, int selectedOption, boolean correct) {
    }

    public record MyProgressDto(String status, int answeredCount, int correctCount, int score,
                                boolean finished, Instant finishedAt, List<AnswerDto> answers) {
    }

    public record CompetitionSummaryDto(Long id, String status, int playerCount, int minPlayers, int maxPlayers,
                                        String hostUsername, Instant lobbyDeadlineAt, Instant createdAt) {
    }

    public record CompetitionPageDto(List<CompetitionSummaryDto> items, int page, int size, long total) {
    }

    /**
     * Authoritative state. {@code players} and {@code me} are only populated for participants;
     * a non-participant sees a summary of an open lobby and nothing else.
     */
    public record CompetitionStateDto(Long id, String status, long version, Instant serverTime,
                                      int minPlayers, int maxPlayers, int playerCount, int questionCount,
                                      int durationSeconds, int countdownSeconds,
                                      Instant lobbyDeadlineAt, Instant startTime, Instant endTime, Instant finishedAt,
                                      String cancelledReason, String hostUsername,
                                      boolean member, boolean canStart, int finishedCount,
                                      List<PlayerDto> players, MyProgressDto me) {
    }

    // ------------------------------------------------------------------ questions / submissions

    /** A question as the client may see it: number, text and options. Nothing else. */
    public record QuestionDto(int number, String text, List<String> options) {
    }

    public record CompetitionQuestionsDto(Long competitionId, Instant serverTime, Instant startTime, Instant endTime,
                                          List<QuestionDto> questions) {
    }

    /** The ONLY thing the client sends for an answer. Identity comes from the JWT; time and score are server-side. */
    public record SubmissionRequest(
            @NotNull(message = "questionNumber is required") @Min(value = 1, message = "questionNumber must be >= 1")
            @Max(value = 50, message = "questionNumber is out of range") Integer questionNumber,
            @NotNull(message = "selectedOption is required") @Min(value = 0, message = "selectedOption must be >= 0")
            @Max(value = 9, message = "selectedOption is out of range") Integer selectedOption) {
    }

    public record SubmissionResultDto(int questionNumber, boolean correct, int scoreAwarded, int totalScore,
                                      int answeredCount, boolean alreadySubmitted, boolean finished, Instant serverTime) {
    }

    public record ParticipantResultDto(boolean finished, Instant finishedAt, int score, int correctCount,
                                       int answeredCount, Instant serverTime) {
    }

    // ------------------------------------------------------------------ results (FINISHED only)

    public record LeaderboardEntryDto(int rank, String username, int score, int correctCount,
                                      long completionTimeMs, boolean answeredAll, boolean you) {
    }

    public record LeaderboardDto(Long competitionId, Instant finishedAt, int participantCount,
                                 List<LeaderboardEntryDto> entries, LeaderboardEntryDto you) {
    }

    /** Post-competition review of the caller's own answers. The only place correct options/explanations appear. */
    public record ReviewItemDto(int number, String text, List<String> options, Integer yourSelectedOption,
                                int correctOption, boolean correct, String explanation) {
    }

    public record ResultReviewDto(Long competitionId, int rank, int score, int correctCount, List<ReviewItemDto> items) {
    }
}
