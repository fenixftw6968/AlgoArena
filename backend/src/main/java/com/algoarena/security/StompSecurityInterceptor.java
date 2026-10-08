package com.algoarena.security;

import com.algoarena.competition.repository.CompetitionParticipantRepository;
import com.algoarena.entity.User;
import com.algoarena.repository.MatchRepository;
import com.algoarena.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.MessageDeliveryException;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.MessageHeaderAccessor;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

import java.security.Principal;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Authentication + authorization for every STOMP frame a browser sends (inbound channel).
 *
 * <ul>
 *   <li><b>CONNECT</b> must carry {@code Authorization: Bearer <jwt>} (the existing JWT mechanism);
 *       the session then runs as that user. No token / bad token / unknown user -> rejected.</li>
 *   <li><b>SUBSCRIBE</b> is allowed only to two exact destination shapes, and only when the caller
 *       is entitled to them:
 *       {@code /topic/match/{matchId}} - caller must be a participant of that match;
 *       {@code /topic/invitations/{userId}} - caller's own id only.
 *       Everything else (wildcards such as {@code /topic/**}, other topics, user queues) is rejected,
 *       so private data can neither be enumerated nor eavesdropped.</li>
 *   <li><b>SEND</b> (and ACK/NACK/BEGIN/COMMIT/ABORT) is rejected outright: the application has no
 *       inbound STOMP routes, and an unprotected simple broker would otherwise relay a client's
 *       message to every subscriber of a topic, letting clients forge server events.</li>
 * </ul>
 *
 * Server-originated events (SimpMessagingTemplate) use the broker channel and are unaffected.
 * Error messages are deliberately generic.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class StompSecurityInterceptor implements ChannelInterceptor {

    private static final Pattern MATCH_TOPIC = Pattern.compile("^/topic/match/([A-Za-z0-9-]{8,64})$");
    private static final Pattern INVITATION_TOPIC = Pattern.compile("^/topic/invitations/(\\d{1,18})$");
    private static final Pattern COMPETITION_TOPIC = Pattern.compile("^/topic/competition/(\\d{1,18})$");

    private final JwtUtil jwtUtil;
    private final UserRepository userRepository;
    private final MatchRepository matchRepository;
    private final CompetitionParticipantRepository competitionParticipants;

    /** Competition topics exist only while the feature is switched on. */
    @Value("${competition.enabled:false}")
    private boolean competitionEnabled;

    /** The authenticated identity attached to a STOMP session. */
    public record StompUser(Long userId, String username) implements Principal {
        @Override
        public String getName() {
            return String.valueOf(userId);
        }
    }

    @Override
    public Message<?> preSend(Message<?> message, MessageChannel channel) {
        StompHeaderAccessor accessor = MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor.class);
        if (accessor == null || accessor.getCommand() == null) {
            return message; // heartbeats and internal session events
        }

        switch (accessor.getCommand()) {
            case CONNECT, STOMP -> authenticate(accessor);
            case SUBSCRIBE -> authorizeSubscription(accessor);
            case UNSUBSCRIBE, DISCONNECT -> { /* always allowed */ }
            default -> throw deny("STOMP command not permitted: " + accessor.getCommand());
        }
        return message;
    }

    private void authenticate(StompHeaderAccessor accessor) {
        String header = accessor.getFirstNativeHeader("Authorization");
        if (header == null) {
            header = accessor.getFirstNativeHeader("authorization");
        }
        if (!StringUtils.hasText(header) || !header.startsWith("Bearer ")) {
            throw deny("Authentication required");
        }
        String token = header.substring(7).trim();
        if (!jwtUtil.isTokenValid(token)) {
            throw deny("Authentication required");
        }
        User user = userRepository.findByEmail(jwtUtil.extractEmail(token)).orElse(null);
        if (user == null) {
            throw deny("Authentication required");
        }
        accessor.setUser(new StompUser(user.getId(), user.getUsername()));
    }

    private void authorizeSubscription(StompHeaderAccessor accessor) {
        if (!(accessor.getUser() instanceof StompUser user)) {
            throw deny("Authentication required");
        }
        String destination = accessor.getDestination();
        if (destination == null) {
            throw deny("Subscription not permitted");
        }

        Matcher invitation = INVITATION_TOPIC.matcher(destination);
        if (invitation.matches()) {
            if (user.userId() == Long.parseLong(invitation.group(1))) {
                return;
            }
            throw deny("Subscription not permitted");
        }

        // Competition notifications: participants of that competition only (never enumerable by id).
        Matcher competition = COMPETITION_TOPIC.matcher(destination);
        if (competition.matches()) {
            if (competitionEnabled && competitionParticipants.isMember(Long.parseLong(competition.group(1)), user.userId())) {
                return;
            }
            throw deny("Subscription not permitted");
        }

        Matcher match = MATCH_TOPIC.matcher(destination);
        if (match.matches() && matchRepository.isParticipant(match.group(1), user.userId())) {
            return;
        }
        throw deny("Subscription not permitted");
    }

    private MessageDeliveryException deny(String reason) {
        return new MessageDeliveryException(reason);
    }
}
