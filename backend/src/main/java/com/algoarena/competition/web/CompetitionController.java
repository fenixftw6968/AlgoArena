package com.algoarena.competition.web;

import com.algoarena.competition.service.CompetitionFacade;
import com.algoarena.competition.web.CompetitionDtos.CompetitionPageDto;
import com.algoarena.competition.web.CompetitionDtos.CompetitionQuestionsDto;
import com.algoarena.competition.web.CompetitionDtos.CompetitionStateDto;
import com.algoarena.competition.web.CompetitionDtos.LeaderboardDto;
import com.algoarena.competition.web.CompetitionDtos.ParticipantResultDto;
import com.algoarena.competition.web.CompetitionDtos.ResultReviewDto;
import com.algoarena.competition.web.CompetitionDtos.SubmissionRequest;
import com.algoarena.competition.web.CompetitionDtos.SubmissionResultDto;
import com.algoarena.entity.User;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

/**
 * REST API of the DSA competition. Thin by design: authentication comes from the JWT (every {@code /api/**}
 * route except the public ones is authenticated by {@code SecurityConfig}), identity ALWAYS comes from the
 * authenticated user - no request carries a user id, score, time or correctness - and everything else is the
 * facade's job. The controller is only registered when {@code competition.enabled=true}.
 */
@RestController
@RequestMapping("/api/competitions")
@RequiredArgsConstructor
@ConditionalOnProperty(prefix = "competition", name = "enabled", havingValue = "true")
public class CompetitionController {

    private final CompetitionFacade facade;

    @PostMapping
    public ResponseEntity<CompetitionStateDto> create(@AuthenticationPrincipal User user) {
        if (user == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        return ResponseEntity.status(HttpStatus.CREATED).body(facade.create(user));
    }

    @GetMapping
    public ResponseEntity<CompetitionPageDto> openLobbies(@AuthenticationPrincipal User user,
                                                         @RequestParam(defaultValue = "LOBBY") String status,
                                                         @RequestParam(defaultValue = "0") int page,
                                                         @RequestParam(defaultValue = "20") int size) {
        if (user == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        if (!"LOBBY".equalsIgnoreCase(status)) {
            throw new com.algoarena.exception.BadRequestException("Only open lobbies (status=LOBBY) can be listed");
        }
        return ResponseEntity.ok(facade.openLobbies(page, size));
    }

    @GetMapping("/{id}")
    public ResponseEntity<CompetitionStateDto> state(@PathVariable Long id, @AuthenticationPrincipal User user) {
        if (user == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        return ResponseEntity.ok(facade.state(id, user));
    }

    @PostMapping("/{id}/join")
    public ResponseEntity<CompetitionStateDto> join(@PathVariable Long id, @AuthenticationPrincipal User user) {
        if (user == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        return ResponseEntity.ok(facade.join(id, user));
    }

    @PostMapping("/{id}/leave")
    public ResponseEntity<Void> leave(@PathVariable Long id, @AuthenticationPrincipal User user) {
        if (user == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        facade.leave(id, user);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{id}/start")
    public ResponseEntity<CompetitionStateDto> start(@PathVariable Long id, @AuthenticationPrincipal User user) {
        if (user == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        return ResponseEntity.ok(facade.start(id, user));
    }

    @GetMapping("/{id}/questions")
    public ResponseEntity<CompetitionQuestionsDto> questions(@PathVariable Long id, @AuthenticationPrincipal User user) {
        if (user == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        return ResponseEntity.ok(facade.questions(id, user));
    }

    @PostMapping("/{id}/submissions")
    public ResponseEntity<SubmissionResultDto> submit(@PathVariable Long id,
                                                      @Valid @RequestBody SubmissionRequest request,
                                                      @AuthenticationPrincipal User user) {
        if (user == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        return ResponseEntity.ok(facade.submit(id, user, request.questionNumber(), request.selectedOption()));
    }

    @PostMapping("/{id}/finish")
    public ResponseEntity<ParticipantResultDto> finish(@PathVariable Long id, @AuthenticationPrincipal User user) {
        if (user == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        return ResponseEntity.ok(facade.finish(id, user));
    }

    @GetMapping("/{id}/leaderboard")
    public ResponseEntity<LeaderboardDto> leaderboard(@PathVariable Long id, @AuthenticationPrincipal User user) {
        if (user == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        return ResponseEntity.ok(facade.leaderboard(id, user));
    }

    @GetMapping("/{id}/results/me")
    public ResponseEntity<ResultReviewDto> myResult(@PathVariable Long id, @AuthenticationPrincipal User user) {
        if (user == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        return ResponseEntity.ok(facade.review(id, user));
    }
}
