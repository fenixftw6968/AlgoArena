package com.algoarena.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.algoarena.dto.MatchAnswerRequest;
import com.algoarena.dto.MatchAnswerResponse;
import com.algoarena.dto.MatchDto;
import com.algoarena.dto.MatchSubmitRequest;
import com.fasterxml.jackson.databind.JsonNode;
import com.algoarena.entity.Match;
import com.algoarena.entity.User;
import com.algoarena.entity.Friendship;
import com.algoarena.exception.BadRequestException;
import com.algoarena.exception.ConflictException;
import com.algoarena.exception.ForbiddenException;
import com.algoarena.exception.ResourceNotFoundException;
import com.algoarena.repository.FriendshipRepository;
import com.algoarena.repository.MatchRepository;
import com.algoarena.repository.UserRepository;
import com.algoarena.util.RankUtil;
import com.algoarena.util.SupportedGames;
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
    private final FriendshipRepository friendshipRepository;
    private final EloRatingService eloRatingService;
    private final GameService gameService;
    private final ObjectMapper objectMapper;
    private final SimpMessagingTemplate messagingTemplate;
    private final TransactionTemplate transactionTemplate;

    private final Object matchmakingLock = new Object();

    private static final Set<String> SUPPORTED_DIFFICULTIES = Set.of("EASY", "MEDIUM", "HARD");

    /** Friend invitations are listed for 60 s; accept honours that window plus a small grace. */
    private static final long INVITATION_TTL_SECONDS = 70;

    // ------------------------------------------------------------------
    // Authorization / validation helpers
    // ------------------------------------------------------------------

    private static boolean isPlayer1(Match match, Long userId) {
        return match.getPlayer1() != null && match.getPlayer1().getId().equals(userId);
    }

    private static boolean isPlayer2(Match match, Long userId) {
        return match.getPlayer2() != null && match.getPlayer2().getId().equals(userId);
    }

    private static void requireParticipant(Match match, Long userId) {
        if (!isPlayer1(match, userId) && !isPlayer2(match, userId)) {
            throw new ForbiddenException("You are not a participant in this match");
        }
    }

    private static boolean isTerminal(Match match) {
        return match.getStatus() == Match.MatchStatus.FINISHED || match.getStatus() == Match.MatchStatus.CANCELLED;
    }

    /** True once the post-pairing countdown has elapsed, i.e. the match is actually being played. */
    private static boolean hasStarted(Match match) {
        return (match.getStatus() == Match.MatchStatus.READY || match.getStatus() == Match.MatchStatus.IN_PROGRESS)
                && match.getStartedAt() != null
                && !match.getStartedAt().isAfter(LocalDateTime.now());
    }

    private static String requireSupportedGameSlug(String gameSlug) {
        return SupportedGames.require(gameSlug);
    }

    /** Blank difficulty stays null (callers apply their own default); anything else must be valid. */
    private static String normaliseDifficulty(String difficulty) {
        if (difficulty == null || difficulty.isBlank()) {
            return null;
        }
        String normalised = difficulty.trim().toUpperCase(Locale.ROOT);
        if (!SUPPORTED_DIFFICULTIES.contains(normalised)) {
            throw new BadRequestException("Unsupported difficulty");
        }
        return normalised;
    }

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
        final String slug = requireSupportedGameSlug(gameSlug);
        final String diff = normaliseDifficulty(difficulty);
        synchronized (matchmakingLock) {
            return transactionTemplate.execute(status -> doQueueForMatch(userId, slug, diff));
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

                if (!isPlayer1(match, userId)) {
                    throw new ForbiddenException("Only the host of this match can add a bot opponent");
                }

                // Bots are only for ranked queue matches; a friend invitation must not be hijacked.
                if (match.getMode() != Match.MatchMode.RANKED) {
                    throw new ConflictException("A bot opponent is only available for ranked queue matches");
                }

                // Already a bot match: idempotent, never re-arm the start time.
                if (Boolean.TRUE.equals(match.getIsBotMatch())) {
                    return convertToDto(match);
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
        if (friendUserId == null) {
            throw new BadRequestException("friendId is required");
        }
        if (hostUserId.equals(friendUserId)) {
            throw new BadRequestException("You cannot invite yourself");
        }
        gameSlug = requireSupportedGameSlug(gameSlug);
        String normalisedDifficulty = normaliseDifficulty(difficulty);
        difficulty = normalisedDifficulty != null ? normalisedDifficulty : "MEDIUM";

        User host = userRepository.findById(hostUserId)
                .orElseThrow(() -> new ResourceNotFoundException("Host user not found"));
        User friend = userRepository.findById(friendUserId)
                .orElseThrow(() -> new ResourceNotFoundException("Friend user not found"));

        boolean areFriends = friendshipRepository.findBetweenUsers(host, friend)
                .map(f -> f.getStatus() == Friendship.Status.ACCEPTED)
                .orElse(false);
        if (!areFriends) {
            throw new ForbiddenException("You can only invite players who are your friends");
        }

        String challengeData = generateChallengeData(gameSlug, difficulty);

        // Replace this host's own previous pending invitations to this friend (never other hosts' invitations)
        List<Match> waiting = matchRepository.findPendingInvitationsForUser(friend);
        for (Match w : waiting) {
            if (!isPlayer1(w, hostUserId)) {
                continue;
            }
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

        if (match.getMode() != Match.MatchMode.FRIEND || !isPlayer2(match, friendUserId)) {
            throw new ForbiddenException("You are not the invited player for this match");
        }

        if (match.getStatus() == Match.MatchStatus.READY || match.getStatus() == Match.MatchStatus.IN_PROGRESS) {
            // Already accepted and ready - return existing authoritative match state idempotently
            MatchDto dto = convertToDto(match);
            broadcastMatchEvent(match.getId(), "MATCH_READY", dto);
            return dto;
        }

        if (match.getStatus() != Match.MatchStatus.WAITING) {
            throw new ConflictException("This match invitation is no longer active");
        }

        if (match.getCreatedAt() != null
                && match.getCreatedAt().isBefore(LocalDateTime.now().minusSeconds(INVITATION_TTL_SECONDS))) {
            throw new ConflictException("This match invitation has expired");
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
        Match match = matchRepository.findByIdWithLock(matchId)
                .orElseThrow(() -> new ResourceNotFoundException("Match not found"));

        if (match.getMode() != Match.MatchMode.FRIEND || !isPlayer2(match, friendUserId)) {
            throw new ForbiddenException("You are not the invited player for this match");
        }

        if (match.getStatus() == Match.MatchStatus.CANCELLED) {
            return convertToDto(match); // already cancelled/declined: safe retry
        }
        if (match.getStatus() != Match.MatchStatus.WAITING) {
            throw new ConflictException("This invitation can no longer be declined");
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
        Match match = matchRepository.findByIdWithLock(matchId)
                .orElseThrow(() -> new ResourceNotFoundException("Match not found"));

        requireParticipant(match, userId);
        boolean isP1 = isPlayer1(match, userId);

        if (isTerminal(match)) {
            return convertToDto(match); // finished/cancelled matches are immutable; safe retry
        }

        // Cancelling a match that is already being played would let a losing player dodge the
        // result, so it is handled exactly like abandoning (forfeit).
        if (hasStarted(match)) {
            return forfeitMatch(match, isP1, userId);
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
        Match match = matchRepository.findByIdWithLock(matchId)
                .orElseThrow(() -> new ResourceNotFoundException("Match not found"));

        requireParticipant(match, userId);

        if (isTerminal(match)) {
            return convertToDto(match); // finished/cancelled matches are immutable; safe retry
        }
        return forfeitMatch(match, isPlayer1(match, userId), userId);
    }

    /** Shared by abandon and cancel-after-start: forfeits a running match, plainly cancels a not-yet-started one. */
    private MatchDto forfeitMatch(Match match, boolean isP1, Long userId) {
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
    public MatchDto getMatchStatus(String matchId, Long userId) {
        Match match = matchRepository.findById(matchId)
                .orElseThrow(() -> new ResourceNotFoundException("Match not found"));
        requireParticipant(match, userId);
        return convertToDto(match, userId);
    }

    @Transactional
    public MatchDto submitMatchResult(String matchId, Long userId, MatchSubmitRequest request) {
        Match match = matchRepository.findByIdWithLock(matchId)
                .orElseThrow(() -> new ResourceNotFoundException("Match not found"));

        requireParticipant(match, userId);
        boolean isPlayer1 = isPlayer1(match, userId);
        boolean isPlayer2 = isPlayer2(match, userId);

        // A finished match is immutable: a late/duplicate submit is a harmless no-op.
        if (match.getStatus() == Match.MatchStatus.FINISHED) {
            return convertToDto(match);
        }
        // Results are only accepted while the match is actually running (never WAITING/CANCELLED).
        if (match.getStatus() != Match.MatchStatus.READY && match.getStatus() != Match.MatchStatus.IN_PROGRESS) {
            throw new ConflictException("This match is not in progress");
        }
        // One official submission per player: a repeat never overwrites the first result.
        if ((isPlayer1 && Boolean.TRUE.equals(match.getPlayer1Finished()))
                || (isPlayer2 && Boolean.TRUE.equals(match.getPlayer2Finished()))) {
            return convertToDto(match);
        }

        // The client-supplied score/time/mistakes (request) are IGNORED: everything is derived from the
        // answers the server graded and recorded. Unanswered questions count as wrong.
        MatchChallenge challenge = MatchChallenge.parse(match.getChallengeData());
        completePlayer(match, isPlayer1, challenge);
        return persistAndBroadcast(match);
    }

    /**
     * Grades and records ONE answer. The server decides correctness from its own copy of the
     * question; the response reveals the right answer/explanation for this question only after the
     * answer has been recorded. Questions must be answered in order, exactly once.
     */
    @Transactional
    public MatchAnswerResponse submitMatchAnswer(String matchId, Long userId, MatchAnswerRequest request) {
        Match match = matchRepository.findByIdWithLock(matchId)
                .orElseThrow(() -> new ResourceNotFoundException("Match not found"));

        requireParticipant(match, userId);
        boolean isP1 = isPlayer1(match, userId);
        String slot = isP1 ? MatchChallenge.P1 : MatchChallenge.P2;

        MatchChallenge challenge = MatchChallenge.parse(match.getChallengeData());
        int total = challenge.questionCount();
        int index = request.getQuestionIndex();
        if (index < 0 || index >= total) {
            throw new BadRequestException("Unknown question");
        }

        // Replay of an already-recorded answer: the first answer stands, nothing changes.
        JsonNode recorded = challenge.recordedAnswer(slot, index);
        if (recorded != null) {
            return buildAnswerResponse(match, challenge, slot, index, recorded.path("c").asBoolean(false), true, userId);
        }

        if (match.getStatus() != Match.MatchStatus.READY && match.getStatus() != Match.MatchStatus.IN_PROGRESS) {
            throw new ConflictException("This match is not in progress");
        }
        if ((isP1 && Boolean.TRUE.equals(match.getPlayer1Finished()))
                || (!isP1 && Boolean.TRUE.equals(match.getPlayer2Finished()))) {
            throw new ConflictException("You have already finished this match");
        }
        if (match.getStartedAt() != null && LocalDateTime.now().isBefore(match.getStartedAt().minusSeconds(2))) {
            throw new ConflictException("The match has not started yet");
        }
        int answered = challenge.answeredCount(slot);
        if (index != answered) {
            throw new ConflictException("Questions must be answered in order; next question is " + answered);
        }

        String given = request.getAnswer();
        boolean correct = MatchChallenge.isCorrect(challenge.question(index), given);
        challenge.record(slot, index, given, correct, System.currentTimeMillis());
        match.setChallengeData(challenge.toJson());

        boolean finishedNow = answered + 1 >= total;
        if (finishedNow) {
            completePlayer(match, isP1, challenge);
            match = matchRepository.save(match);
            persistAndBroadcast(match);
        } else {
            match = matchRepository.save(match);
        }
        return buildAnswerResponse(match, challenge, slot, index, correct, false, userId);
    }

    private MatchAnswerResponse buildAnswerResponse(Match match, MatchChallenge challenge, String slot, int index,
                                                    boolean correct, boolean alreadyAnswered, Long userId) {
        JsonNode question = challenge.question(index);
        int answeredCount = challenge.answeredCount(slot);
        return MatchAnswerResponse.builder()
                .correct(correct)
                .correctAnswer(MatchChallenge.correctAnswerOf(question))
                .explanation(MatchChallenge.explanationOf(question))
                .questionIndex(index)
                .answeredCount(answeredCount)
                .totalQuestions(challenge.questionCount())
                .alreadyAnswered(alreadyAnswered)
                .finished(answeredCount >= challenge.questionCount())
                .match(convertToDto(match, userId))
                .build();
    }

    /** Marks a player finished using ONLY server-recorded results (score = correct answers). */
    private void completePlayer(Match match, boolean isP1, MatchChallenge challenge) {
        String slot = isP1 ? MatchChallenge.P1 : MatchChallenge.P2;
        int total = challenge.questionCount();
        int score = challenge.correctCount(slot);
        int mistakes = Math.max(0, total - score);
        int seconds = match.getStartedAt() == null ? 0
                : (int) Math.max(0, java.time.Duration.between(match.getStartedAt(), LocalDateTime.now()).getSeconds());

        if (isP1) {
            match.setPlayer1Score(score);
            match.setPlayer1TimeSeconds(seconds);
            match.setPlayer1Mistakes(mistakes);
            match.setPlayer1Finished(true);

            // Bot match: the bot's result is simulated from the player's SERVER-derived result
            if (Boolean.TRUE.equals(match.getIsBotMatch())) {
                Random rnd = new Random();
                // 45% equal score, 35% bot gets 1 less, 20% bot gets 1 more
                double r = rnd.nextDouble();
                int scoreOffset = r < 0.45 ? 0 : (r < 0.80 ? -1 : 1);
                int botScore = Math.max(0, Math.min(10, score + scoreOffset));
                int botTime = Math.max(15, seconds + (rnd.nextInt(15) - 7));
                int botMistakes = Math.max(0, 10 - botScore);

                match.setPlayer2Score(botScore);
                match.setPlayer2TimeSeconds(botTime);
                match.setPlayer2Mistakes(botMistakes);
                match.setPlayer2Finished(true);
            }
        } else {
            match.setPlayer2Score(score);
            match.setPlayer2TimeSeconds(seconds);
            match.setPlayer2Mistakes(mistakes);
            match.setPlayer2Finished(true);
        }
    }

    /** Finalises the match when both sides are done, persists, and notifies participants. */
    private MatchDto persistAndBroadcast(Match match) {
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
        return convertToDto(match, null);
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

    /**
     * Builds the stored (server-only) challenge: the full questions including correct answers, in the
     * {@link MatchChallenge} wrapper. Clients only ever receive {@link MatchChallenge#toClientJson}.
     */
    private String generateChallengeData(String gameSlug, String difficulty) {
        return MatchChallenge.fromQuestionsJson(generateQuestionsJson(gameSlug, difficulty));
    }

    private String generateQuestionsJson(String gameSlug, String difficulty) {
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
                    if ("code-breaker".equalsIgnoreCase(normalizedSlug)) {
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
            // Full (answer-bearing) DB puzzles; stored server-side only and sanitised for clients.
            List<Map<String, Object>> puzzles = gameService.getPuzzlesForMatch(gameSlug, difficulty != null ? difficulty : "MEDIUM");
            if (puzzles == null || puzzles.isEmpty()) {
                puzzles = gameService.getPuzzlesForMatch(gameSlug, null);
            }
            if (puzzles != null && !puzzles.isEmpty()) {
                puzzles = new ArrayList<>(puzzles);
                Collections.shuffle(puzzles);
                int limit = ("dsa-master-quiz".equalsIgnoreCase(gameSlug) || "number-detective".equalsIgnoreCase(gameSlug)) ? 5 : 10;
                List<Map<String, Object>> chosen = puzzles.stream().limit(limit).toList();
                return objectMapper.writeValueAsString(chosen);
            }
        } catch (Exception e) {
            log.warn("Could not generate puzzle list from DB for match: {}", e.getMessage());
        }
        return "[]";
    }

    public MatchDto convertToDto(Match match) {
        return convertToDto(match, null);
    }

    /**
     * Client-safe DTO. {@code challengeData} is always the sanitised view (no answers/explanations);
     * {@code viewerId} (if a participant) adds that player's own progress.
     */
    public MatchDto convertToDto(Match match, Long viewerId) {
        MatchChallenge challenge = MatchChallenge.parse(match.getChallengeData());
        String viewerSlot = viewerId == null ? null
                : (isPlayer1(match, viewerId) ? MatchChallenge.P1 : (isPlayer2(match, viewerId) ? MatchChallenge.P2 : null));
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
                .challengeData(MatchChallenge.toClientJson(match.getChallengeData()))
                .totalQuestions(challenge.questionCount())
                .viewerAnsweredCount(viewerSlot == null ? null : challenge.answeredCount(viewerSlot))
                .viewerCorrectCount(viewerSlot == null ? null : challenge.correctCount(viewerSlot))
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
        return convertToDto(activeMatches.get(0), userId);
    }
}
