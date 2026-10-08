package com.algoarena.websocket;

import com.algoarena.config.SecurityConfig;
import com.algoarena.config.WebSocketConfig;
import com.algoarena.entity.User;
import com.algoarena.repository.MatchRepository;
import com.algoarena.repository.UserRepository;
import com.algoarena.security.JwtAuthFilter;
import com.algoarena.security.JwtUtil;
import com.algoarena.security.StompSecurityInterceptor;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.EnableAutoConfiguration;
import org.springframework.boot.autoconfigure.data.jpa.JpaRepositoriesAutoConfiguration;
import org.springframework.boot.autoconfigure.jdbc.DataSourceAutoConfiguration;
import org.springframework.boot.autoconfigure.jdbc.DataSourceTransactionManagerAutoConfiguration;
import org.springframework.boot.autoconfigure.orm.jpa.HibernateJpaAutoConfiguration;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Import;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static com.algoarena.websocket.StompTestSupport.TRUSTED_ORIGIN;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.when;

/**
 * P0.8 - black-box tests against a REAL embedded server and a REAL STOMP client.
 *
 * <p>Before the fix, the same attacks were run against the unsecured configuration and all succeeded:
 * anonymous CONNECT was accepted, an anonymous client received private match/invitation events
 * (also via the wildcard subscription {@code /topic/**}, which received every topic's traffic), and a
 * client SEND to {@code /topic/...} was relayed by the broker to subscribers (forged
 * MATCH_FINISHED delivered). These tests pin the secured behaviour.
 */
@SpringBootTest(classes = WebSocketSecurityIntegrationTest.Ctx.class,
        webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
        properties = {
                "cors.allowed-origins=http://localhost:5173",
                "jwt.secret=ws-test-secret-ws-test-secret-ws-test-secret-ws-test-secret-1234567890",
                "jwt.expiration=3600000"})
class WebSocketSecurityIntegrationTest {

    @Configuration
    @EnableAutoConfiguration(exclude = {DataSourceAutoConfiguration.class, HibernateJpaAutoConfiguration.class,
            JpaRepositoriesAutoConfiguration.class, DataSourceTransactionManagerAutoConfiguration.class})
    @Import({WebSocketConfig.class, StompSecurityInterceptor.class, SecurityConfig.class, JwtAuthFilter.class, JwtUtil.class})
    static class Ctx {
    }

    private static final String MATCH_ID = "11111111-2222-3333-4444-555555555555";

    @LocalServerPort int port;
    @Autowired SimpMessagingTemplate template;
    @Autowired JwtUtil jwtUtil;
    @MockBean UserRepository userRepository;
    @MockBean MatchRepository matchRepository;
    @MockBean com.algoarena.competition.repository.CompetitionParticipantRepository competitionParticipantRepository;

    private final List<StompTestSupport.Client> clients = new ArrayList<>();

    private User alice;  // participant of MATCH_ID
    private User bob;    // participant of MATCH_ID
    private User mallory; // not a participant

    @BeforeEach
    void setUp() {
        alice = User.builder().id(1L).username("alice").email("alice@x.com").build();
        bob = User.builder().id(2L).username("bob").email("bob@x.com").build();
        mallory = User.builder().id(3L).username("mallory").email("mallory@x.com").build();
        for (User u : List.of(alice, bob, mallory)) {
            when(userRepository.findByEmail(u.getEmail())).thenReturn(Optional.of(u));
        }
        when(matchRepository.isParticipant(MATCH_ID, 1L)).thenReturn(true);
        when(matchRepository.isParticipant(MATCH_ID, 2L)).thenReturn(true);
        when(matchRepository.isParticipant(MATCH_ID, 3L)).thenReturn(false);
    }

    @AfterEach
    void tearDown() {
        clients.forEach(c -> {
            try {
                c.close();
            } catch (Exception ignored) {
            }
        });
    }

    private String tokenFor(User u) {
        return jwtUtil.generateToken(u.getEmail(), u.getId(), u.getUsername());
    }

    private StompTestSupport.Client connect(String token) throws Exception {
        StompTestSupport.Client c = StompTestSupport.connect(port, TRUSTED_ORIGIN, token);
        clients.add(c);
        return c;
    }

    private StompTestSupport.Client connectAs(User u) throws Exception {
        StompTestSupport.Client c = connect(tokenFor(u));
        assertTrue(c.connectedOk.get(), u.getUsername() + " should be able to connect, errors=" + c.errors);
        return c;
    }

    private void assertSubscriptionRejected(StompTestSupport.Client c, String destination) throws Exception {
        c.subscribe(destination);
        assertTrue(c.awaitClosed(4000), "server must close the session after a forbidden subscription to " + destination);
        assertFalse(c.isConnected(), destination);
    }

    // ------------------------------------------------------------------ authentication (CONNECT)

    @Test
    void anonymousConnectIsRejected() throws Exception {
        StompTestSupport.Client c = connect(null);

        assertFalse(c.connectedOk.get(), "CONNECT without a token must be refused");
        assertFalse(c.errors.isEmpty());
    }

    @Test
    void garbageAndForgedTokensAreRejected() throws Exception {
        assertFalse(connect("not-a-jwt").connectedOk.get());
        assertFalse(connect("aaa.bbb.ccc").connectedOk.get());

        JwtUtil attackerKey = new JwtUtil();
        ReflectionTestUtils.setField(attackerKey, "secret", "attacker-secret-attacker-secret-attacker-secret-attacker-secret-0000");
        ReflectionTestUtils.setField(attackerKey, "expiration", 3600000L);
        String forged = attackerKey.generateToken(alice.getEmail(), alice.getId(), alice.getUsername());
        assertFalse(connect(forged).connectedOk.get(), "token signed with a different key must be refused");
    }

    @Test
    void validTokenOfADeletedUserIsRejected() throws Exception {
        String token = jwtUtil.generateToken("ghost@x.com", 99L, "ghost");
        when(userRepository.findByEmail("ghost@x.com")).thenReturn(Optional.empty());

        assertFalse(connect(token).connectedOk.get());
    }

    @Test
    void handshakeFromAnUntrustedOriginIsRefusedEvenWithAValidToken() throws Exception {
        StompTestSupport.Client c = StompTestSupport.connect(port, "https://evil.example", tokenFor(alice));
        clients.add(c);

        assertFalse(c.connectedOk.get());
    }

    @Test
    void validTokenConnects() throws Exception {
        assertTrue(connectAs(alice).isConnected());
    }

    // ------------------------------------------------------------------ authorised delivery keeps working

    @Test
    void participantsReceiveMatchEvents() throws Exception {
        StompTestSupport.Client a = connectAs(alice);
        StompTestSupport.Client b = connectAs(bob);
        a.subscribe("/topic/match/" + MATCH_ID);
        b.subscribe("/topic/match/" + MATCH_ID);
        Thread.sleep(400);

        template.convertAndSend("/topic/match/" + MATCH_ID, Map.of("type", "MATCH_READY", "data", Map.of("id", MATCH_ID)));

        String forAlice = a.nextMessage(3000);
        String forBob = b.nextMessage(3000);
        assertNotNull(forAlice, "participant 1 must receive the event");
        assertNotNull(forBob, "participant 2 must receive the event");
        assertTrue(forAlice.contains("MATCH_READY"));
        assertTrue(a.isConnected() && b.isConnected());
    }

    @Test
    void userReceivesTheirOwnInvitationEvents() throws Exception {
        StompTestSupport.Client a = connectAs(alice);
        a.subscribe("/topic/invitations/1");
        Thread.sleep(400);

        template.convertAndSend("/topic/invitations/1", Map.of("type", "NEW_INVITATION"));

        String msg = a.nextMessage(3000);
        assertNotNull(msg);
        assertTrue(msg.contains("NEW_INVITATION"));
    }

    // ------------------------------------------------------------------ authorisation (SUBSCRIBE)

    @Test
    void nonParticipantCannotSubscribeToAMatchTopicAndNeverReceivesItsEvents() throws Exception {
        StompTestSupport.Client m = connectAs(mallory);

        assertSubscriptionRejected(m, "/topic/match/" + MATCH_ID);

        template.convertAndSend("/topic/match/" + MATCH_ID, Map.of("type", "MATCH_READY", "data", "PRIVATE"));
        assertNull(m.nextMessage(800), "nothing may reach a rejected subscriber");
    }

    @Test
    void userCannotSubscribeToAnotherUsersInvitationTopic() throws Exception {
        StompTestSupport.Client m = connectAs(mallory);

        assertSubscriptionRejected(m, "/topic/invitations/1");
        template.convertAndSend("/topic/invitations/1", Map.of("type", "NEW_INVITATION", "data", "PRIVATE"));
        assertNull(m.nextMessage(800));
    }

    @Test
    void userIdsCannotBeEnumeratedBySubscribing() throws Exception {
        for (long id : new long[]{1L, 2L, 4L, 42L, 999999L}) {
            StompTestSupport.Client m = connectAs(mallory);
            assertSubscriptionRejected(m, "/topic/invitations/" + id);
        }
    }

    @Test
    void wildcardAndUnknownDestinationsAreRejected() throws Exception {
        for (String destination : new String[]{
                "/topic/**", "/topic/*", "/topic/#", "/topic/match/**", "/topic/match/*", "/topic/invitations/*",
                "/topic/invitations/**", "/topic/match/" + MATCH_ID + "/extra", "/topic/match/../invitations/2",
                "/topic/match/short", "/topic/anything-else", "/queue/private", "/user/queue/private", "/app/x", "/"}) {
            StompTestSupport.Client c = connectAs(alice); // even a legitimate, authenticated user
            assertSubscriptionRejected(c, destination);
        }
    }

    @Test
    void aWildcardSubscriberNeverSeesOtherTopicsTraffic() throws Exception {
        StompTestSupport.Client c = connectAs(alice);
        c.subscribe("/topic/**");
        assertTrue(c.awaitClosed(4000));

        template.convertAndSend("/topic/something/else", Map.of("type", "OTHER", "data", "SECRET"));
        template.convertAndSend("/topic/match/" + MATCH_ID, Map.of("type", "MATCH_READY", "data", "SECRET"));
        assertNull(c.nextMessage(800));
    }

    // ------------------------------------------------------------------ forging (SEND)

    @Test
    void clientsCannotPublishToBrokerTopicsEvenAsParticipants() throws Exception {
        StompTestSupport.Client victim = connectAs(bob);
        victim.subscribe("/topic/match/" + MATCH_ID);
        Thread.sleep(400);

        StompTestSupport.Client attacker = connectAs(alice); // a real participant, still must not be able to forge
        attacker.send("/topic/match/" + MATCH_ID, "{\"type\":\"MATCH_FINISHED\",\"data\":{\"winnerId\":1}}");

        assertTrue(attacker.awaitClosed(4000), "a client SEND must be refused and the session closed");
        assertNull(victim.nextMessage(1000), "a forged event must never reach other subscribers");
        assertTrue(victim.isConnected());
    }

    @Test
    void clientSendToApplicationDestinationsIsRejectedToo() throws Exception {
        StompTestSupport.Client c = connectAs(alice);
        c.send("/app/anything", "x");

        assertTrue(c.awaitClosed(4000));
    }

    @Test
    void forgedEventsToOthersInvitationTopicAreRejected() throws Exception {
        StompTestSupport.Client victim = connectAs(bob);
        victim.subscribe("/topic/invitations/2");
        Thread.sleep(400);

        StompTestSupport.Client attacker = connectAs(mallory);
        attacker.send("/topic/invitations/2", "{\"type\":\"NEW_INVITATION\"}");

        assertTrue(attacker.awaitClosed(4000));
        assertNull(victim.nextMessage(1000));
    }

    // ------------------------------------------------------------------ one bad client does not affect good ones

    @Test
    void rejectedClientsDoNotDisturbLegitimateSubscribers() throws Exception {
        StompTestSupport.Client good = connectAs(alice);
        good.subscribe("/topic/match/" + MATCH_ID);
        Thread.sleep(400);

        assertSubscriptionRejected(connectAs(mallory), "/topic/match/" + MATCH_ID);

        template.convertAndSend("/topic/match/" + MATCH_ID, Map.of("type", "MATCH_UPDATE"));
        assertNotNull(good.nextMessage(3000));
    }
}
