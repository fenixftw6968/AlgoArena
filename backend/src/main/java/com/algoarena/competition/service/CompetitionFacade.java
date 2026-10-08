package com.algoarena.competition.service;

import com.algoarena.competition.config.CompetitionProperties;
import com.algoarena.competition.domain.Competition;
import com.algoarena.competition.repository.CompetitionRepository;
import com.algoarena.competition.web.CompetitionDtos.CompetitionPageDto;
import com.algoarena.competition.web.CompetitionDtos.CompetitionQuestionsDto;
import com.algoarena.competition.web.CompetitionDtos.CompetitionStateDto;
import com.algoarena.competition.web.CompetitionDtos.LeaderboardDto;
import com.algoarena.competition.web.CompetitionDtos.ParticipantResultDto;
import com.algoarena.competition.web.CompetitionDtos.ResultReviewDto;
import com.algoarena.competition.web.CompetitionDtos.SubmissionResultDto;
import com.algoarena.competition.ws.CompetitionPresenceService;
import com.algoarena.entity.User;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

import java.time.Clock;
import java.time.Instant;

/**
 * The single entry point used by the controller. Deliberately NOT transactional itself: it orchestrates the
 * independent transactions of the services, in an order that cannot deadlock (competition lock, then participant
 * locks), and takes care of the things that must happen BETWEEN them:
 * <ul>
 *   <li>captures the server receive time at the very edge, before any database wait;</li>
 *   <li>applies per-user rate limits;</li>
 *   <li>lazily performs an overdue lifecycle step so users never depend on the ticker thread;</li>
 *   <li>closes the competition early once the last participant finishes.</li>
 * </ul>
 */
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(prefix = "competition", name = "enabled", havingValue = "true")
public class CompetitionFacade {

    private final CompetitionLobbyService lobby;
    private final CompetitionLifecycleService lifecycle;
    private final CompetitionSubmissionService submissions;
    private final CompetitionQueryService query;
    private final CompetitionRateLimiter rateLimiter;
    private final CompetitionPresenceService presence;
    private final CompetitionRepository competitions;
    private final CompetitionProperties props;
    private final Clock clock;

    public CompetitionStateDto create(User user) {
        rateLimiter.checkCreate(user.getId());
        Competition c = lobby.create(user);
        return query.state(c.getId(), user.getId());
    }

    public CompetitionPageDto openLobbies(int page, int size) {
        return query.openLobbies(page, size);
    }

    public CompetitionStateDto state(Long id, User user) {
        advanceIfDue(id);
        presence.touch(user.getId());
        return query.state(id, user.getId());
    }

    public CompetitionStateDto join(Long id, User user) {
        rateLimiter.checkJoin(user.getId());
        advanceIfDue(id);
        lobby.join(id, user);
        return query.state(id, user.getId());
    }

    public void leave(Long id, User user) {
        rateLimiter.checkJoin(user.getId());
        lobby.leave(id, user.getId());
    }

    public CompetitionStateDto start(Long id, User user) {
        rateLimiter.checkStart(user.getId());
        lobby.start(id, user);
        return query.state(id, user.getId());
    }

    public CompetitionQuestionsDto questions(Long id, User user) {
        advanceIfDue(id);
        presence.touch(user.getId());
        return query.questions(id, user.getId());
    }

    public SubmissionResultDto submit(Long id, User user, int questionNumber, int selectedOption) {
        Instant receivedAt = clock.instant(); // server time, captured before any waiting
        rateLimiter.checkSubmit(user.getId());
        advanceIfDue(id);
        SubmissionResultDto result = submissions.submit(id, user.getId(), questionNumber, selectedOption, receivedAt);
        if (result.finished()) {
            lifecycle.closeIfAllFinished(id);
        }
        return result;
    }

    public ParticipantResultDto finish(Long id, User user) {
        Instant receivedAt = clock.instant();
        rateLimiter.checkFinish(user.getId());
        advanceIfDue(id);
        ParticipantResultDto result = submissions.finish(id, user.getId(), receivedAt);
        lifecycle.closeIfAllFinished(id);
        return result;
    }

    public LeaderboardDto leaderboard(Long id, User user) {
        advanceIfDue(id);
        return query.leaderboard(id, user.getId());
    }

    public ResultReviewDto review(Long id, User user) {
        advanceIfDue(id);
        return query.review(id, user.getId());
    }

    /** Cheap unlocked look first; only take the lock if a step is actually overdue. */
    private void advanceIfDue(Long id) {
        competitions.findStatusView(id).ifPresent(view -> {
            if (CompetitionLifecycleService.isDue(view, clock.instant(), props.getFinalizeDelayMs())) {
                lifecycle.advance(id);
            }
        });
    }
}
