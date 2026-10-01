package com.mindmaze.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.mindmaze.dto.MatchDto;
import com.mindmaze.dto.MatchSubmitRequest;
import com.mindmaze.dto.PuzzleDto;
import com.mindmaze.entity.Match;
import com.mindmaze.entity.User;
import com.mindmaze.exception.BadRequestException;
import com.mindmaze.exception.ResourceNotFoundException;
import com.mindmaze.repository.MatchRepository;
import com.mindmaze.repository.UserRepository;
import com.mindmaze.util.RankUtil;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.LocalDateTime;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

@Service
@RequiredArgsConstructor
@Slf4j
public class MatchService {

    private final MatchRepository matchRepository;
    private final UserRepository userRepository;
    private final EloRatingService eloRatingService;
    private final GameService gameService;
    private final ObjectMapper objectMapper;
    private final SimpMessagingTemplate messagingTemplate;
    private final TransactionTemplate transactionTemplate;

    private final Object matchmakingLock = new Object();

    @PostConstruct
    void configureMatchmakingTransaction() {
        // Matchmaking writes must commit *while matchmakingLock is still held*.
        // REQUIRES_NEW guarantees the transaction is committed by the time execute()
        // returns, i.e. before the monitor is released, so the next player's
        // SELECT can already see this player's row.
        transactionTemplate.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
        transactionTemplate.setIsolationLevel(TransactionDefinition.ISOLATION_READ_COMMITTED);
    }

    /**
     * Queues a player for ranked matchmaking (claim an open slot, otherwise create one).
     *
     * <p>The whole flow runs inside {@code matchmakingLock} and inside its own transaction that
     * commits before the lock is released. {@code flush()} alone is not enough: without a commit
     * the row stays invisible to other READ_COMMITTED transactions, so two players tapping
     * "Ranked" at the same moment would each create their own WAITING row and never be matched.
     */
    public MatchDto queueForMatch(Long userId, String gameSlug, String difficulty) {
        synchronized (matchmakingLock) {
            return transactionTemplate.execute(status -> doQueueForMatch(userId, gameSlug, difficulty));
        }
    }

    private MatchDto doQueueForMatch(Long userId, String gameSlug, String difficulty) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

        LocalDateTime cutoff = LocalDateTime.now().minusSeconds(90);

        // Step 1: Idempotent check - if user already has an active match for this game, return it
        List<Match> myActive = matchRepository.findActiveMatchesByUserAndGame(user, gameSlug, cutoff);
        for (Match m : myActive) {
            if (m.getMode() == Match.MatchMode.RANKED) {
                log.info("[Matchmaking] User {} already has active match {} (status={}), returning it",
                        userId, m.getId(), m.getStatus());
                return convertToDto(m);
            }
        }

        // Step 2: Cancel user's own old stale WAITING ranked matches
        List<Match> existingWaiting = matchRepository.findWaitingMatchesByUser(user);
        for (Match m : existingWaiting) {
            if (m.getMode() == Match.MatchMode.RANKED) {
                if (gameSlug.equalsIgnoreCase(m.getGameSlug()) && m.getCreatedAt() != null && m.getCreatedAt().isAfter(cutoff)) {
                    // Fresh match for same game - return idempotently (player re-queued)
                    log.info("[Matchmaking] User {} already waiting on match {}, returning it", userId, m.getId());
                    return convertToDto(m);
                } else {
                    // Old/stale match - cancel it
                    m.setStatus(Match.MatchStatus.CANCELLED);
                    m.setCancelledReason("SUPERSEDED");
                    matchRepository.save(m);
                    log.info("[Matchmaking] Cancelled stale match {} for user {}", m.getId(), userId);
                }
            }
        }

        // Step 3: Atomically try to claim a waiting opponent using FOR UPDATE SKIP LOCKED
        // This prevents two concurrent Player-2s from claiming the same slot.
        // (Re-entrant: matchmakingLock is already held by queueForMatch.)
        synchronized (matchmakingLock) {
            Optional<Match> lockedMatch = matchRepository.findAndLockWaitingRankedMatch(gameSlug, userId, cutoff);
            if (lockedMatch.isPresent()) {
                Match openMatch = lockedMatch.get();
                
                // Double-check it's still WAITING (could have been claimed by another thread between query and lock)
                if (openMatch.getStatus() != Match.MatchStatus.WAITING) {
                    log.warn("[Matchmaking] Match {} was no longer WAITING after lock, creating new slot", openMatch.getId());
                } else {
                    openMatch.setPlayer2(user);
                    openMatch.setPlayer1RatingBefore(openMatch.getPlayer1().getCompetitiveRating() != null ?
                            openMatch.getPlayer1().getCompetitiveRating() : 500);
                    openMatch.setPlayer2RatingBefore(user.getCompetitiveRating() != null ?
                            user.getCompetitiveRating() : 500);
                    openMatch.setStatus(Match.MatchStatus.READY);
                    openMatch.setPlayer1Ready(true);
                    openMatch.setPlayer2Ready(true);
                    openMatch.setIsBotMatch(false);
                    openMatch.setStartedAt(LocalDateTime.now().plusSeconds(4));

                    // Always regenerate challenge data when pairing so both players get fresh, same questions
                    String challengeData = generateChallengeData(gameSlug, openMatch.getDifficulty());
                    openMatch.setChallengeData(challengeData);

                    openMatch = matchRepository.save(openMatch);

                    MatchDto dto = convertToDto(openMatch);

                    // Notify both players instantly via WebSocket
                    broadcastMatchEvent(openMatch.getId(), "MATCH_READY", dto);
                    sendUserEvent(openMatch.getPlayer1().getId(), "MATCH_READY", dto);
                    sendUserEvent(user.getId(), "MATCH_READY", dto);

                    log.info("[Matchmaking] ✅ Matched user {} with user {} on match {}",
                            userId, openMatch.getPlayer1().getId(), openMatch.getId());
                    return dto;
                }
            }

            // Step 4: No opponent found - create a new waiting slot for this player
            String chosenDiff = (difficulty != null && !difficulty.isBlank()) ? difficulty : "MEDIUM";
            String challengeData = generateChallengeData(gameSlug, chosenDiff);

            Match match = Match.builder()
                    .gameSlug(gameSlug)
                    .difficulty(chosenDiff)
                    .mode(Match.MatchMode.RANKED)
                    .status(Match.MatchStatus.WAITING)
                    .player1(user)
                    .player1Ready(true)
                    .player1RatingBefore(user.getCompetitiveRating() != null ? user.getCompetitiveRating() : 500)
                    .challengeData(challengeData)
                    .isBotMatch(false)
                    .build();

            match = matchRepository.save(match);
            log.info("[Matchmaking] User {} queued for ranked match {}, waiting for opponent", userId, match.getId());
            return convertToDto(match);
        }
    }

    public void cancelQueue(Long userId, String gameSlug) {
        synchronized (matchmakingLock) {
            // Commit inside the lock so a concurrent queue request can never claim a slot
            // that is being cancelled at the same moment.
            transactionTemplate.executeWithoutResult(status -> {
                User user = userRepository.findById(userId).orElse(null);
                if (user != null) {
                    List<Match> waiting = matchRepository.findWaitingMatchesByUser(user);
                    for (Match m : waiting) {
                        if (m.getMode() == Match.MatchMode.RANKED && (gameSlug == null || m.getGameSlug().equals(gameSlug))) {
                            m.setStatus(Match.MatchStatus.CANCELLED);
                            m.setCancelledReason("CANCELLED_BY_PLAYER");
                            matchRepository.save(m);
                            broadcastMatchEvent(m.getId(), "MATCH_CANCELLED", convertToDto(m));
                        }
                    }
                }
            });
        }
    }

    public MatchDto connectBotMatch(String matchId, Long userId) {
        synchronized (matchmakingLock) {
            return transactionTemplate.execute(status -> {
                Match match = matchRepository.findByIdWithLock(matchId)
                        .orElseThrow(() -> new ResourceNotFoundException("Match not found"));

                if (!match.getPlayer1().getId().equals(userId)) {
                    throw new BadRequestException("User is not the host of this match");
                }

                // If a real player already matched while request was inflight, return the real match
                if (match.getStatus() == Match.MatchStatus.READY && match.getPlayer2() != null && !Boolean.TRUE.equals(match.getIsBotMatch())) {
                    return convertToDto(match);
                }

                if (match.getStatus() != Match.MatchStatus.WAITING && match.getStatus() != Match.MatchStatus.READY) {
                    throw new BadRequestException("Match is not in a connectable state");
                }

                int userRating = match.getPlayer1RatingBefore() != null ? match.getPlayer1RatingBefore() : 500;
                // Bot rating dynamically close to user's rating (± 20 points)
                int botRating = Math.max(100, userRating + (new Random().nextInt(41) - 20));

                match.setIsBotMatch(true);
                match.setMode(Match.MatchMode.RANKED);
                match.setStatus(Match.MatchStatus.READY);
                match.setPlayer1Ready(true);
                match.setPlayer2Ready(true);
                match.setPlayer2RatingBefore(botRating);
                match.setStartedAt(LocalDateTime.now().plusSeconds(4));

                match = matchRepository.save(match);
                MatchDto dto = convertToDto(match);
                broadcastMatchEvent(match.getId(), "MATCH_READY", dto);
                return dto;
            });
        }
    }

    @Transactional
    public MatchDto createFriendMatch(Long hostUserId, Long friendUserId, String gameSlug, String difficulty) {
        User host = userRepository.findById(hostUserId)
                .orElseThrow(() -> new ResourceNotFoundException("Host user not found"));
        User friend = userRepository.findById(friendUserId)
                .orElseThrow(() -> new ResourceNotFoundException("Friend user not found"));

        String challengeData = generateChallengeData(gameSlug, difficulty);

        // Cancel all previous waiting friend invitations for this friend
        List<Match> waiting = matchRepository.findPendingInvitationsForUser(friend);
        for (Match w : waiting) {
            w.setStatus(Match.MatchStatus.CANCELLED);
            w.setCancelledReason("REPLACED_BY_NEW_INVITATION");
            matchRepository.save(w);
        }

        Match match = Match.builder()
                .gameSlug(gameSlug)
                .difficulty(difficulty)
                .mode(Match.MatchMode.FRIEND)
                .status(Match.MatchStatus.WAITING)
                .player1(host)
                .player2(friend)
                .player1Ready(true)
                .player2Ready(false)
                .player1RatingBefore(host.getCompetitiveRating() != null ? host.getCompetitiveRating() : 500)
                .player2RatingBefore(friend.getCompetitiveRating() != null ? friend.getCompetitiveRating() : 500)
                .challengeData(challengeData)
                .isBotMatch(false)
                .build();

        match = matchRepository.save(match);
        MatchDto dto = convertToDto(match);
        sendUserEvent(friendUserId, "NEW_INVITATION", dto);
        return dto;
    }

    @Transactional(readOnly = true)
    public List<MatchDto> getPendingInvitations(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));
        return matchRepository.findPendingInvitationsForUser(user).stream()
                .filter(m -> m.getCreatedAt().isAfter(LocalDateTime.now().minusSeconds(60)))
                .map(this::convertToDto)
                .toList();
    }

    @Transactional
    public MatchDto acceptFriendMatch(String matchId, Long friendUserId) {
        Match match = matchRepository.findByIdWithLock(matchId)
                .orElseThrow(() -> new ResourceNotFoundException("Match not found"));

        if (!match.getPlayer2().getId().equals(friendUserId)) {
            throw new BadRequestException("You are not the invited player for this match");
        }

        if (match.getStatus() == Match.MatchStatus.READY || match.getStatus() == Match.MatchStatus.IN_PROGRESS) {
            // Already accepted and ready - return existing authoritative match state idempotently
            MatchDto dto = convertToDto(match);
            broadcastMatchEvent(match.getId(), "MATCH_READY", dto);
            return dto;
        }

        if (match.getStatus() != Match.MatchStatus.WAITING) {
            throw new BadRequestException("This match invitation is no longer active");
        }

        match.setPlayer2Ready(true);
        match.setStatus(Match.MatchStatus.READY);
        match.setStartedAt(LocalDateTime.now().plusSeconds(4));
        match = matchRepository.save(match);

        // Cancel any other waiting invitations for this user
        List<Match> otherPending = matchRepository.findPendingInvitationsForUser(match.getPlayer2());
        for (Match p : otherPending) {
            if (!p.getId().equals(match.getId())) {
                p.setStatus(Match.MatchStatus.CANCELLED);
                p.setCancelledReason("ACCEPTED_ANOTHER_MATCH");
                matchRepository.save(p);
            }
        }

        MatchDto dto = convertToDto(match);
        broadcastMatchEvent(match.getId(), "MATCH_READY", dto);
        sendUserEvent(match.getPlayer1().getId(), "INVITATION_ACCEPTED", dto);
        return dto;
    }

    @Transactional
    public MatchDto declineFriendMatch(String matchId, Long friendUserId) {
        Match match = matchRepository.findById(matchId)
                .orElseThrow(() -> new ResourceNotFoundException("Match not found"));

        if (!match.getPlayer2().getId().equals(friendUserId)) {
            throw new BadRequestException("You are not the invited player for this match");
        }

        match.setStatus(Match.MatchStatus.CANCELLED);
        match.setCancelledReason("DECLINED");
        match = matchRepository.save(match);
        MatchDto dto = convertToDto(match);
        broadcastMatchEvent(match.getId(), "MATCH_CANCELLED", dto);
        sendUserEvent(match.getPlayer1().getId(), "INVITATION_DECLINED", dto);
        return dto;
    }

    @Transactional
    public MatchDto cancelMatch(String matchId, Long userId) {
        Match match = matchRepository.findById(matchId)
                .orElseThrow(() -> new ResourceNotFoundException("Match not found"));

        boolean isP1 = match.getPlayer1().getId().equals(userId);
        boolean isP2 = match.getPlayer2() != null && match.getPlayer2().getId().equals(userId);

        if (!isP1 && !isP2) {
            throw new BadRequestException("You are not a participant in this match");
        }

        match.setStatus(Match.MatchStatus.CANCELLED);
        match.setCancelledReason(isP1 ? "CANCELLED_BY_HOST" : "CANCELLED_BY_OPPONENT");
        match = matchRepository.save(match);

        cancelQueue(userId, match.getGameSlug());
        MatchDto dto = convertToDto(match);
        broadcastMatchEvent(match.getId(), "MATCH_CANCELLED", dto);

        if (match.getMode() == Match.MatchMode.FRIEND) {
            Long otherUserId = isP1 ? (match.getPlayer2() != null ? match.getPlayer2().getId() : null) : match.getPlayer1().getId();
            if (otherUserId != null) {
                sendUserEvent(otherUserId, "INVITATION_CANCELLED", dto);
            }
        }
        return dto;
    }

    @Transactional
    public MatchDto abandonMatch(String matchId, Long userId) {
        Match match = matchRepository.findById(matchId)
                .orElseThrow(() -> new ResourceNotFoundException("Match not found"));

        boolean isP1 = match.getPlayer1().getId().equals(userId);
        boolean isP2 = match.getPlayer2() != null && match.getPlayer2().getId().equals(userId);

        if (!isP1 && !isP2) {
            throw new BadRequestException("You are not a participant in this match");
        }

        if (match.getStatus() == Match.MatchStatus.READY || match.getStatus() == Match.MatchStatus.IN_PROGRESS) {
            // Forfeit match: the abandoning player loses
            if (isP1) {
                match.setPlayer1Score(0);
                match.setPlayer1Finished(true);
                if (match.getPlayer2() != null) {
                    match.setPlayer2Score(Math.max(1, match.getPlayer2Score() != null ? match.getPlayer2Score() : 1));
                    match.setPlayer2Finished(true);
                }
            } else {
                match.setPlayer2Score(0);
                match.setPlayer2Finished(true);
                match.setPlayer1Score(Math.max(1, match.getPlayer1Score() != null ? match.getPlayer1Score() : 1));
                match.setPlayer1Finished(true);
            }
            finalizeMatch(match);
            match.setCancelledReason("ABANDONED");
            match = matchRepository.save(match);
        } else {
            match.setStatus(Match.MatchStatus.CANCELLED);
            match.setCancelledReason("ABANDONED");
            match = matchRepository.save(match);
        }

        cancelQueue(userId, match.getGameSlug());
        MatchDto dto = convertToDto(match);
        broadcastMatchEvent(match.getId(), "MATCH_ABANDONED", dto);
        return dto;
    }

    @Transactional(readOnly = true)
    public MatchDto getMatchStatus(String matchId) {
        Match match = matchRepository.findById(matchId)
                .orElseThrow(() -> new ResourceNotFoundException("Match not found"));
        return convertToDto(match);
    }

    @Transactional
    public MatchDto submitMatchResult(String matchId, Long userId, MatchSubmitRequest request) {
        Match match = matchRepository.findByIdWithLock(matchId)
                .orElseThrow(() -> new ResourceNotFoundException("Match not found"));

        boolean isPlayer1 = match.getPlayer1().getId().equals(userId);
        boolean isPlayer2 = match.getPlayer2() != null && match.getPlayer2().getId().equals(userId);

        if (!isPlayer1 && !isPlayer2) {
            throw new BadRequestException("User is not part of this match");
        }

        if (isPlayer1) {
            match.setPlayer1Score(request.getScore() != null ? request.getScore() : 0);
            match.setPlayer1TimeSeconds(request.getTimeTakenSeconds() != null ? request.getTimeTakenSeconds() : 0);
            match.setPlayer1Mistakes(request.getMistakes() != null ? request.getMistakes() : 0);
            match.setPlayer1Finished(true);

            // If this is a bot match, simulate bot opponent's performance right now
            if (Boolean.TRUE.equals(match.getIsBotMatch())) {
                int userScore = request.getScore() != null ? request.getScore() : 0;
                int userTime = request.getTimeTakenSeconds() != null ? request.getTimeTakenSeconds() : 60;
                Random rnd = new Random();
                // 45% equal score, 35% bot gets 1 less, 20% bot gets 1 more
                double r = rnd.nextDouble();
                int scoreOffset = r < 0.45 ? 0 : (r < 0.80 ? -1 : 1);
                int botScore = Math.max(0, Math.min(10, userScore + scoreOffset));
                int botTime = Math.max(15, userTime + (rnd.nextInt(15) - 7));
                int botMistakes = Math.max(0, 10 - botScore);

                match.setPlayer2Score(botScore);
                match.setPlayer2TimeSeconds(botTime);
                match.setPlayer2Mistakes(botMistakes);
                match.setPlayer2Finished(true);
            }
        } else {
            match.setPlayer2Score(request.getScore() != null ? request.getScore() : 0);
            match.setPlayer2TimeSeconds(request.getTimeTakenSeconds() != null ? request.getTimeTakenSeconds() : 0);
            match.setPlayer2Mistakes(request.getMistakes() != null ? request.getMistakes() : 0);
            match.setPlayer2Finished(true);
        }

        // If both finished (or if solo queue completed vs AI / async bot fallback if player2 was auto-simulated)
        if (Boolean.TRUE.equals(match.getPlayer1Finished()) && Boolean.TRUE.equals(match.getPlayer2Finished())) {
            finalizeMatch(match);
        } else if (match.getPlayer2() == null && !Boolean.TRUE.equals(match.getIsBotMatch())) {
            // Solo test finish
            match.setStatus(Match.MatchStatus.FINISHED);
            match.setFinishedAt(LocalDateTime.now());
        }

        match = matchRepository.save(match);
        MatchDto dto = convertToDto(match);
        broadcastMatchEvent(match.getId(), "MATCH_UPDATE", dto);
        
        if (match.getStatus() == Match.MatchStatus.FINISHED) {
            broadcastMatchEvent(match.getId(), "MATCH_FINISHED", dto);
            broadcastMatchEvent(match.getId(), "MATCH_COMPLETED", dto);
            if (match.getPlayer1() != null) {
                sendUserEvent(match.getPlayer1().getId(), "MATCH_COMPLETED", dto);
            }
            if (match.getPlayer2() != null) {
                sendUserEvent(match.getPlayer2().getId(), "MATCH_COMPLETED", dto);
            }
        }
        return dto;
    }

    private void finalizeMatch(Match match) {
        if (match.getStatus() == Match.MatchStatus.FINISHED) return;

        int score1 = match.getPlayer1Score() != null ? match.getPlayer1Score() : 0;
        int score2 = match.getPlayer2Score() != null ? match.getPlayer2Score() : 0;
        int time1  = match.getPlayer1TimeSeconds() != null ? match.getPlayer1TimeSeconds() : 999;
        int time2  = match.getPlayer2TimeSeconds() != null ? match.getPlayer2TimeSeconds() : 999;
        int err1   = match.getPlayer1Mistakes() != null ? match.getPlayer1Mistakes() : 0;
        int err2   = match.getPlayer2Mistakes() != null ? match.getPlayer2Mistakes() : 0;

        double actualScore1 = 0.5; // Draw
        if (score1 > score2) {
            actualScore1 = 1.0;
        } else if (score2 > score1) {
            actualScore1 = 0.0;
        } else {
            // Tie-breaker: fewer mistakes
            if (err1 < err2) {
                actualScore1 = 1.0;
            } else if (err2 < err1) {
                actualScore1 = 0.0;
            } else {
                // Tie-breaker: faster time
                if (time1 < time2) actualScore1 = 1.0;
                else if (time2 < time1) actualScore1 = 0.0;
            }
        }

        User p1 = match.getPlayer1();
        User p2 = match.getPlayer2();

        int r1 = p1.getCompetitiveRating() != null ? p1.getCompetitiveRating() : 500;
        int r2 = p2 != null && p2.getCompetitiveRating() != null ? p2.getCompetitiveRating() : 
                 (match.getPlayer2RatingBefore() != null ? match.getPlayer2RatingBefore() : 500);

        match.setPlayer1RatingBefore(r1);
        match.setPlayer2RatingBefore(r2);

        if (actualScore1 == 1.0) {
            match.setWinnerId(p1.getId());
            p1.setMatchesWon((p1.getMatchesWon() != null ? p1.getMatchesWon() : 0) + 1);
        } else if (actualScore1 == 0.0) {
            if (p2 != null) {
                match.setWinnerId(p2.getId());
                p2.setMatchesWon((p2.getMatchesWon() != null ? p2.getMatchesWon() : 0) + 1);
            } else if (Boolean.TRUE.equals(match.getIsBotMatch())) {
                match.setWinnerId(999999L);
            }
        }

        p1.setMatchesPlayed((p1.getMatchesPlayed() != null ? p1.getMatchesPlayed() : 0) + 1);
        if (p2 != null) {
            p2.setMatchesPlayed((p2.getMatchesPlayed() != null ? p2.getMatchesPlayed() : 0) + 1);
        }

        // Apply Elo rating changes for Ranked matches (including Ranked Bot matches!)
        if (match.getMode() == Match.MatchMode.RANKED) {
            EloRatingService.EloResult eloResult = eloRatingService.calculateNewRatings(r1, r2, actualScore1);
            match.setPlayer1RatingChange(eloResult.getDeltaA());
            match.setPlayer2RatingChange(eloResult.getDeltaB());

            p1.setCompetitiveRating(eloResult.getNewRatingA());
            if (p2 != null) {
                p2.setCompetitiveRating(eloResult.getNewRatingB());
                userRepository.save(p2);
            }
        } else {
            match.setPlayer1RatingChange(0);
            match.setPlayer2RatingChange(0);
        }

        userRepository.save(p1);

        match.setStatus(Match.MatchStatus.FINISHED);
        match.setFinishedAt(LocalDateTime.now());
    }

    private void broadcastMatchEvent(String matchId, String type, MatchDto data) {
        try {
            Map<String, Object> payload = new HashMap<>();
            payload.put("type", type);
            payload.put("data", data);
            messagingTemplate.convertAndSend("/topic/match/" + matchId, payload);
        } catch (Exception e) {
            log.warn("Failed to broadcast match event: {}", e.getMessage());
        }
    }

    private void sendUserEvent(Long userId, String type, Object data) {
        if (userId == null) return;
        try {
            Map<String, Object> payload = new HashMap<>();
            payload.put("type", type);
            payload.put("data", data);
            messagingTemplate.convertAndSend("/topic/invitations/" + userId, payload);
            log.info("[WS] Sent user event {} to /topic/invitations/{}", type, userId);
        } catch (Exception e) {
            log.warn("Failed to send user event: {}", e.getMessage());
        }
    }

    @Transactional(readOnly = true)
    public List<MatchDto> getRecentMatches(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));
        return matchRepository.findRecentMatchesByUser(user).stream()
                .limit(10)
                .map(this::convertToDto)
                .toList();
    }

    private String generateChallengeData(String gameSlug, String difficulty) {
        if (gameSlug == null || gameSlug.isBlank()) return "[]";
        String normalizedSlug = gameSlug.toLowerCase().trim();
        String resourcePath = "questions/" + normalizedSlug + ".json";

        try (var is = getClass().getClassLoader().getResourceAsStream(resourcePath)) {
            if (is != null) {
                List<Map<String, Object>> allQuestions = objectMapper.readValue(is, new TypeReference<List<Map<String, Object>>>() {});
                if (allQuestions != null && !allQuestions.isEmpty()) {
                    String normDiff = (difficulty != null && !difficulty.isBlank()) ? difficulty.trim().toUpperCase() : "MEDIUM";
                    List<Map<String, Object>> filtered = allQuestions.stream()
                            .filter(q -> {
                                Object diffObj = q.get("difficulty");
                                if (diffObj == null) return true;
                                return normDiff.equalsIgnoreCase(diffObj.toString().trim());
                            })
                            .toList();

                    List<Map<String, Object>> pool = (!filtered.isEmpty()) ? new ArrayList<>(filtered) : new ArrayList<>(allQuestions);
                    Collections.shuffle(pool);

                    int count = 5;
                    if ("memory-challenge".equalsIgnoreCase(normalizedSlug) || "code-breaker".equalsIgnoreCase(normalizedSlug)) {
                        count = 4;
                    }
                    List<Map<String, Object>> chosen = pool.stream().limit(count).map(q -> {
                        Map<String, Object> copy = new HashMap<>(q);
                        Object optsObj = copy.get("options");
                        if (optsObj instanceof List<?> list && !list.isEmpty()) {
                            List<Object> shuffledOpts = new ArrayList<>(list);
                            Collections.shuffle(shuffledOpts);
                            copy.put("options", shuffledOpts);
                        }
                        return copy;
                    }).toList();
                    return objectMapper.writeValueAsString(chosen);
                }
            }
        } catch (Exception e) {
            log.warn("Could not load challenge questions from resource {}: {}", resourcePath, e.getMessage());
        }

        if ("number-detective".equalsIgnoreCase(gameSlug)) {
            List<Map<String, Object>> puzzles = new ArrayList<>();
            List<Map<String, Object>> bank = new ArrayList<>();
            bank.add(new HashMap<>(Map.of("id", "nd-1", "question", "2, 4, 8, 16, ?", "correctAnswer", "32", "options", new ArrayList<>(List.of("24", "30", "32", "36")), "hint", "Notice how each number doubles.", "explanation", "Each number is multiplied by 2.")));
            bank.add(new HashMap<>(Map.of("id", "nd-2", "question", "5, 10, 15, 20, ?", "correctAnswer", "25", "options", new ArrayList<>(List.of("22", "25", "30", "35")), "hint", "Add 5 to the previous number.", "explanation", "Arithmetic sequence with a common difference of +5.")));
            bank.add(new HashMap<>(Map.of("id", "nd-3", "question", "100, 90, 80, 70, ?", "correctAnswer", "60", "options", new ArrayList<>(List.of("50", "55", "60", "65")), "hint", "Decrease by 10.", "explanation", "Subtract 10 from each number consecutively.")));
            bank.add(new HashMap<>(Map.of("id", "nd-4", "question", "3, 6, 9, 12, ?", "correctAnswer", "15", "options", new ArrayList<>(List.of("14", "15", "16", "18")), "hint", "Multiples of 3.", "explanation", "Multiples of 3 increasing by 3 each step.")));
            bank.add(new HashMap<>(Map.of("id", "nd-5", "question", "1, 4, 9, 16, ?", "correctAnswer", "25", "options", new ArrayList<>(List.of("20", "24", "25", "36")), "hint", "Perfect squares.", "explanation", "Perfect squares: 1^2, 2^2, 3^2, 4^2, 5^2.")));
            bank.add(new HashMap<>(Map.of("id", "nd-6", "question", "1, 2, 4, 7, 11, ?", "correctAnswer", "16", "options", new ArrayList<>(List.of("13", "14", "15", "16")), "hint", "Differences increase by 1.", "explanation", "+1, +2, +3, +4, +5...")));
            bank.add(new HashMap<>(Map.of("id", "nd-7", "question", "2, 3, 5, 8, 13, ?", "correctAnswer", "21", "options", new ArrayList<>(List.of("18", "20", "21", "25")), "hint", "Sum of preceding two.", "explanation", "Fibonacci sequence.")));
            bank.add(new HashMap<>(Map.of("id", "nd-8", "question", "1, 8, 27, 64, ?", "correctAnswer", "125", "options", new ArrayList<>(List.of("100", "121", "125", "150")), "hint", "Perfect cubes.", "explanation", "Perfect cubes: 1^3, 2^3, 3^3, 4^3, 5^3.")));
            
            Collections.shuffle(bank);
            for (int i = 0; i < Math.min(4, bank.size()); i++) {
                Map<String, Object> p = new HashMap<>(bank.get(i));
                Object optsObj = p.get("options");
                if (optsObj instanceof List<?> l) {
                    List<Object> shuff = new ArrayList<>(l);
                    Collections.shuffle(shuff);
                    p.put("options", shuff);
                }
                puzzles.add(p);
            }
            try {
                return objectMapper.writeValueAsString(puzzles);
            } catch (Exception e) {
                return "[]";
            }
        }

        if ("memory-challenge".equalsIgnoreCase(gameSlug)) {
            List<Map<String, Object>> puzzles = new ArrayList<>();
            List<Map<String, Object>> bank = new ArrayList<>();
            
            bank.add(Map.of(
                "id", "mc-1",
                "title", "Farmer's Market Stand",
                "revealTime", 8,
                "description", "Memorize the 6 fresh fruits and vegetables.",
                "items", List.of(
                    Map.of("emoji", "🍎", "label", "Red Apple"),
                    Map.of("emoji", "🍌", "label", "Yellow Banana"),
                    Map.of("emoji", "🥕", "label", "Orange Carrot"),
                    Map.of("emoji", "🍇", "label", "Purple Grapes"),
                    Map.of("emoji", "🥦", "label", "Green Broccoli"),
                    Map.of("emoji", "🍓", "label", "Red Strawberry")
                ),
                "question", "Which purple fruit was on the market table?",
                "options", List.of("Purple Grapes", "Eggplant", "Plum", "Blueberries"),
                "correctAnswer", "Purple Grapes",
                "explanation", "The market table contained Purple Grapes."
            ));
            
            bank.add(Map.of(
                "id", "mc-2",
                "title", "Stationery Desk",
                "revealTime", 8,
                "description", "Memorize the study tools placed on the desk.",
                "items", List.of(
                    Map.of("emoji", "✂️", "label", "Silver Scissors"),
                    Map.of("emoji", "📏", "label", "Yellow Ruler"),
                    Map.of("emoji", "📐", "label", "Triangle Protractor"),
                    Map.of("emoji", "📎", "label", "Paperclip"),
                    Map.of("emoji", "✏️", "label", "Pencil"),
                    Map.of("emoji", "📌", "label", "Red Pushpin")
                ),
                "question", "What color was the ruler on the desk?",
                "options", List.of("Yellow", "Blue", "Clear", "Green"),
                "correctAnswer", "Yellow",
                "explanation", "The ruler was bright yellow."
            ));

            bank.add(Map.of(
                "id", "mc-3",
                "title", "Pet Shop Window",
                "revealTime", 8,
                "description", "Observe the animals resting in the pet store.",
                "items", List.of(
                    Map.of("emoji", "🐶", "label", "Golden Dog"),
                    Map.of("emoji", "🐱", "label", "Tabby Cat"),
                    Map.of("emoji", "🐹", "label", "Hamster"),
                    Map.of("emoji", "🐰", "label", "White Rabbit"),
                    Map.of("emoji", "🦜", "label", "Green Parrot"),
                    Map.of("emoji", "🐠", "label", "Goldfish")
                ),
                "question", "Which bird was in the pet shop window?",
                "options", List.of("Green Parrot", "Canary", "Pigeon", "Owl"),
                "correctAnswer", "Green Parrot",
                "explanation", "The window featured a Green Parrot."
            ));

            bank.add(Map.of(
                "id", "mc-4",
                "title", "Art Studio Shelf",
                "revealTime", 8,
                "description", "Memorize the art supplies on the shelf.",
                "items", List.of(
                    Map.of("emoji", "🎨", "label", "Paint Palette"),
                    Map.of("emoji", "🖌️", "label", "Paintbrush"),
                    Map.of("emoji", "📐", "label", "Ruler"),
                    Map.of("emoji", "✏️", "label", "Sketch Pencil"),
                    Map.of("emoji", "📓", "label", "Notebook"),
                    Map.of("emoji", "🏺", "label", "Clay Vase")
                ),
                "question", "What container was placed on the shelf?",
                "options", List.of("Clay Vase", "Glass Jar", "Metal Bucket", "Plastic Cup"),
                "correctAnswer", "Clay Vase",
                "explanation", "A Clay Vase was sitting on the shelf."
            ));
            
            Collections.shuffle(bank);
            for (int i = 0; i < Math.min(4, bank.size()); i++) {
                Map<String, Object> p = new HashMap<>(bank.get(i));
                Object optsObj = p.get("options");
                if (optsObj instanceof List<?> l) {
                    List<Object> shuff = new ArrayList<>(l);
                    Collections.shuffle(shuff);
                    p.put("options", shuff);
                }
                puzzles.add(p);
            }
            try {
                return objectMapper.writeValueAsString(puzzles);
            } catch (Exception e) {
                return "[]";
            }
        }

        if ("code-breaker".equalsIgnoreCase(gameSlug)) {
            List<Map<String, Object>> puzzles = new ArrayList<>();
            List<Map<String, Object>> bank = new ArrayList<>();
            
            bank.add(Map.of(
                "id", "cb-1",
                "title", "The Vault Code",
                "digitCount", 3,
                "secret", "042",
                "correctAnswer", "042",
                "clues", List.of(
                    Map.of("guess", "682", "text", "One digit is correct and in the correct position", "correctPos", 1, "wrongPos", 0),
                    Map.of("guess", "614", "text", "One digit is correct but in the wrong position", "correctPos", 0, "wrongPos", 1),
                    Map.of("guess", "206", "text", "Two digits are correct but in the wrong positions", "correctPos", 0, "wrongPos", 2),
                    Map.of("guess", "738", "text", "No digit is correct", "correctPos", 0, "wrongPos", 0),
                    Map.of("guess", "780", "text", "One digit is correct but in the wrong position", "correctPos", 0, "wrongPos", 1)
                ),
                "hint", "7, 3, and 8 are completely eliminated.",
                "explanation", "Secret code is 042."
            ));
            
            bank.add(Map.of(
                "id", "cb-2",
                "title", "Subway Locker",
                "digitCount", 3,
                "secret", "679",
                "correctAnswer", "679",
                "clues", List.of(
                    Map.of("guess", "147", "text", "One digit is correct but in the wrong position", "correctPos", 0, "wrongPos", 1),
                    Map.of("guess", "189", "text", "One digit is correct and in the correct position", "correctPos", 1, "wrongPos", 0),
                    Map.of("guess", "964", "text", "Two digits are correct but in the wrong positions", "correctPos", 0, "wrongPos", 2),
                    Map.of("guess", "523", "text", "No digit is correct", "correctPos", 0, "wrongPos", 0),
                    Map.of("guess", "286", "text", "One digit is correct but in the wrong position", "correctPos", 0, "wrongPos", 1)
                ),
                "hint", "5, 2, and 3 are eliminated.",
                "explanation", "Secret code is 679."
            ));

            bank.add(Map.of(
                "id", "cb-3",
                "title", "Bank Strongbox",
                "digitCount", 3,
                "secret", "384",
                "correctAnswer", "384",
                "clues", List.of(
                    Map.of("guess", "294", "text", "One digit is correct and in the correct position", "correctPos", 1, "wrongPos", 0),
                    Map.of("guess", "245", "text", "One digit is correct but in the wrong position", "correctPos", 0, "wrongPos", 1),
                    Map.of("guess", "489", "text", "Two digits are correct but in the wrong positions", "correctPos", 0, "wrongPos", 2),
                    Map.of("guess", "176", "text", "No digit is correct", "correctPos", 0, "wrongPos", 0),
                    Map.of("guess", "583", "text", "Two digits are correct but in the wrong positions", "correctPos", 0, "wrongPos", 2)
                ),
                "hint", "1, 7, and 6 are out.",
                "explanation", "Secret code is 384."
            ));

            bank.add(Map.of(
                "id", "cb-4",
                "title", "Research Lab LabCode",
                "digitCount", 3,
                "secret", "816",
                "correctAnswer", "816",
                "clues", List.of(
                    Map.of("guess", "291", "text", "One digit is correct but in the wrong position", "correctPos", 0, "wrongPos", 1),
                    Map.of("guess", "245", "text", "No digit is correct", "correctPos", 0, "wrongPos", 0),
                    Map.of("guess", "463", "text", "One digit is correct but in the wrong position", "correctPos", 0, "wrongPos", 1),
                    Map.of("guess", "578", "text", "One digit is correct but in the wrong position", "correctPos", 0, "wrongPos", 1),
                    Map.of("guess", "386", "text", "Two digits are correct but in the wrong positions", "correctPos", 0, "wrongPos", 2)
                ),
                "hint", "2, 4, 5 are eliminated.",
                "explanation", "Secret code is 816."
            ));
            
            Collections.shuffle(bank);
            for (int i = 0; i < Math.min(4, bank.size()); i++) {
                puzzles.add(bank.get(i));
            }
            try {
                return objectMapper.writeValueAsString(puzzles);
            } catch (Exception e) {
                return "[]";
            }
        }

        try {
            List<PuzzleDto> puzzles = gameService.getPuzzlesByGame(gameSlug, difficulty != null ? difficulty : "MEDIUM");
            if (puzzles == null || puzzles.isEmpty()) {
                puzzles = gameService.getPuzzlesByGame(gameSlug, null);
            }
            if (puzzles != null && !puzzles.isEmpty()) {
                Collections.shuffle(puzzles);
                int limit = ("dsa-master-quiz".equalsIgnoreCase(gameSlug) || "number-detective".equalsIgnoreCase(gameSlug)) ? 5 : 10;
                List<PuzzleDto> chosen = puzzles.stream().limit(limit).toList();
                return objectMapper.writeValueAsString(chosen);
            }
        } catch (Exception e) {
            log.warn("Could not generate puzzle list from DB for match: {}", e.getMessage());
        }
        return "[]";
    }

    public MatchDto convertToDto(Match match) {
        User p1 = match.getPlayer1();
        User p2 = match.getPlayer2();

        int p1Rating = match.getPlayer1RatingBefore() != null ? match.getPlayer1RatingBefore() : (p1.getCompetitiveRating() != null ? p1.getCompetitiveRating() : 500);
        int p2Rating = match.getPlayer2RatingBefore() != null ? match.getPlayer2RatingBefore() : (p2 != null && p2.getCompetitiveRating() != null ? p2.getCompetitiveRating() : 500);

        String winnerName = null;
        if (match.getWinnerId() != null) {
            if (p1.getId().equals(match.getWinnerId())) winnerName = p1.getUsername();
            else if (p2 != null && p2.getId().equals(match.getWinnerId())) winnerName = p2.getUsername();
            else if (Boolean.TRUE.equals(match.getIsBotMatch())) winnerName = "CortexAI_Bot";
        }

        Long startedAtMillis = null;
        if (match.getStartedAt() != null) {
            startedAtMillis = match.getStartedAt().atZone(java.time.ZoneId.systemDefault()).toInstant().toEpochMilli();
        }

        Long p2Id = p2 != null ? p2.getId() : (Boolean.TRUE.equals(match.getIsBotMatch()) ? 999999L : null);
        String p2Username = p2 != null ? p2.getUsername() : (Boolean.TRUE.equals(match.getIsBotMatch()) ? "CortexAI_Bot" : null);
        Boolean p2Ready = Boolean.TRUE.equals(match.getIsBotMatch()) ? Boolean.TRUE
                : (match.getPlayer2Ready() != null ? match.getPlayer2Ready() : Boolean.FALSE);

        // Null-safe boolean reads (defensive for legacy DB rows with null values)
        Boolean p1ReadySafe = match.getPlayer1Ready() != null ? match.getPlayer1Ready() : Boolean.FALSE;
        Boolean p1FinishedSafe = match.getPlayer1Finished() != null ? match.getPlayer1Finished() : Boolean.FALSE;
        Boolean p2FinishedSafe = match.getPlayer2Finished() != null ? match.getPlayer2Finished() : Boolean.FALSE;

        return MatchDto.builder()
                .id(match.getId())
                .gameSlug(match.getGameSlug())
                .difficulty(match.getDifficulty())
                .mode(match.getMode().name())
                .status(match.getStatus().name())
                .player1Id(p1.getId())
                .player1Username(p1.getUsername())
                .player1Rating(p1Rating)
                .player1Rank(RankUtil.getRankName(p1Rating))
                .player1Score(match.getPlayer1Score())
                .player1TimeSeconds(match.getPlayer1TimeSeconds())
                .player1RatingChange(match.getPlayer1RatingChange())
                .player1Ready(p1ReadySafe)
                .player1Finished(p1FinishedSafe)
                .player2Id(p2Id)
                .player2Username(p2Username)
                .player2Rating(p2Rating)
                .player2Rank(RankUtil.getRankName(p2Rating))
                .player2Score(match.getPlayer2Score())
                .player2TimeSeconds(match.getPlayer2TimeSeconds())
                .player2RatingChange(match.getPlayer2RatingChange())
                .player2Ready(p2Ready)
                .player2Finished(p2FinishedSafe)
                .winnerId(match.getWinnerId())
                .winnerUsername(winnerName)
                .challengeData(match.getChallengeData())
                .isBotMatch(match.getIsBotMatch())
                .cancelledReason(match.getCancelledReason())
                .createdAt(match.getCreatedAt())
                .startedAt(match.getStartedAt())
                .finishedAt(match.getFinishedAt())
                .startedAtMillis(startedAtMillis)
                .serverTimeMillis(System.currentTimeMillis())
                .build();
    }

    @Transactional(readOnly = true)
    public MatchDto getActiveMatch(Long userId, String gameSlug) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));
        LocalDateTime cutoff = LocalDateTime.now().minusMinutes(5);
        List<Match> activeMatches = matchRepository.findActiveMatchesByUserAndGame(user, gameSlug, cutoff);
        if (activeMatches.isEmpty()) {
            return null;
        }
        return convertToDto(activeMatches.get(0));
    }
}
