package com.algoarena.websocket;

import com.algoarena.competition.repository.CompetitionParticipantRepository;
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

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static com.algoarena.websocket.StompTestSupport.TRUSTED_ORIGIN;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.when;

/** Real server + real STOMP client: who may listen to /topic/competition/{id}, and that nobody can forge events. */
@SpringBootTest(classes = CompetitionWebSocketSecurityTest.Ctx.class,
        webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
        properties = {
                "cors.allowed-origins=http://localhost:5173",
                "competition.enabled=true",
                "jwt.secret=ws-test-secret-ws-test-secret-ws-test-secret-ws-test-secret-1234567890",
                "jwt.expiration=3600000"})
class CompetitionWebSocketSecurityTest {

    @Configuration
    @EnableAutoConfiguration(exclude = {DataSourceAutoConfiguration.class, HibernateJpaAutoConfiguration.class,
            JpaRepositoriesAutoConfiguration.class, DataSourceTransactionManagerAutoConfiguration.class})
    @Import({WebSocketConfig.class, StompSecurityInterceptor.class, SecurityConfig.class, JwtAuthFilter.class, JwtUtil.class})
    static class Ctx {
    }

    private static final long COMPETITION = 42L;
    private static final String TOPIC = "/topic/competition/" + COMPETITION;

    @LocalServerPort int port;
    @Autowired SimpMessagingTemplate template;
    @Autowired JwtUtil jwtUtil;
    @MockBean UserRepository userRepository;
    @MockBean MatchRepository matchRepository;
    @MockBean CompetitionParticipantRepository competitionParticipants;

    private final List<StompTestSupport.Client> clients = new ArrayList<>();
    private User alice;    // member
    private User bob;      // member
    private User mallory;  // not a member

    @BeforeEach
    void setUp() {
        alice = User.builder().id(1L).username("alice").email("alice@x.com").build();
        bob = User.builder().id(2L).username("bob").email("bob@x.com").build();
        mallory = User.builder().id(3L).username("mallory").email("mallory@x.com").build();
        for (User u : List.of(alice, bob, mallory)) {
            when(userRepository.findByEmail(u.getEmail())).thenReturn(Optional.of(u));
        }
        when(competitionParticipants.isMember(COMPETITION, 1L)).thenReturn(true);
        when(competitionParticipants.isMember(COMPETITION, 2L)).thenReturn(true);
        when(competitionParticipants.isMember(COMPETITION, 3L)).thenReturn(false);
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

    private StompTestSupport.Client connectAs(User u) throws Exception {
        StompTestSupport.Client c = StompTestSupport.connect(port, TRUSTED_ORIGIN, jwtUtil.generateToken(u.getEmail(), u.getId(), u.getUsername()));
        clients.add(c);
        assertTrue(c.connectedOk.get(), "errors=" + c.errors);
        return c;
    }

    @Test
    void membersReceiveCompetitionEvents() throws Exception {
        StompTestSupport.Client a = connectAs(alice);
        StompTestSupport.Client b = connectAs(bob);
        a.subscribe(TOPIC);
        b.subscribe(TOPIC);
        Thread.sleep(400);

        template.convertAndSend(TOPIC, Map.of("type", "COMPETITION_STARTED", "version", 3));

        assertTrue(a.nextMessage(3000).contains("COMPETITION_STARTED"));
        assertTrue(b.nextMessage(3000).contains("COMPETITION_STARTED"));
    }

    @Test
    void aNonMemberCannotListenAndReceivesNothing() throws Exception {
        StompTestSupport.Client m = connectAs(mallory);
        m.subscribe(TOPIC);

        assertTrue(m.awaitClosed(4000), "the session must be closed after a forbidden subscription");
        template.convertAndSend(TOPIC, Map.of("type", "COMPETITION_STARTED"));
        assertNull(m.nextMessage(800));
    }

    @Test
    void competitionIdsCannotBeEnumerated() throws Exception {
        for (long id : new long[]{1L, 41L, 43L, 999999L}) {
            StompTestSupport.Client m = connectAs(alice);
            m.subscribe("/topic/competition/" + id);
            assertTrue(m.awaitClosed(4000), "competition " + id);
        }
    }

    @Test
    void wildcardsAndMalformedCompetitionTopicsAreRejected() throws Exception {
        for (String destination : new String[]{"/topic/competition/*", "/topic/competition/**", "/topic/competition/",
                "/topic/competition/42/extra", "/topic/competition/abc", "/topic/competition/42%2F..", "/topic/competition/-1",
                "/topic/competition/1234567890123456789012"}) {
            StompTestSupport.Client c = connectAs(alice);
            c.subscribe(destination);
            assertTrue(c.awaitClosed(4000), destination);
        }
    }

    @Test
    void membersCannotForgeCompetitionEvents() throws Exception {
        StompTestSupport.Client victim = connectAs(bob);
        victim.subscribe(TOPIC);
        Thread.sleep(400);

        StompTestSupport.Client attacker = connectAs(alice);
        attacker.send(TOPIC, "{\"type\":\"COMPETITION_ENDED\"}");

        assertTrue(attacker.awaitClosed(4000));
        assertNull(victim.nextMessage(1000), "a forged event must never reach other participants");
        assertTrue(victim.isConnected());
    }

    @Test
    void aMemberWhoLeavesCannotSubscribeAgainAndReconnectingMembersCan() throws Exception {
        StompTestSupport.Client first = connectAs(alice);
        first.subscribe(TOPIC);
        Thread.sleep(300);
        first.close();

        // reconnect (new session, same user) works while still a member
        StompTestSupport.Client again = connectAs(alice);
        again.subscribe(TOPIC);
        Thread.sleep(400);
        template.convertAndSend(TOPIC, Map.of("type", "LOBBY_UPDATED"));
        assertNotNull(again.nextMessage(3000));

        // after leaving, membership is gone
        when(competitionParticipants.isMember(COMPETITION, 1L)).thenReturn(false);
        StompTestSupport.Client afterLeaving = connectAs(alice);
        afterLeaving.subscribe(TOPIC);
        assertTrue(afterLeaving.awaitClosed(4000));
    }

    @Test
    void sameUserMayHaveSeveralTabsOpen() throws Exception {
        StompTestSupport.Client tab1 = connectAs(alice);
        StompTestSupport.Client tab2 = connectAs(alice);
        tab1.subscribe(TOPIC);
        tab2.subscribe(TOPIC);
        Thread.sleep(400);

        template.convertAndSend(TOPIC, Map.of("type", "LOBBY_UPDATED"));

        assertNotNull(tab1.nextMessage(3000));
        assertNotNull(tab2.nextMessage(3000));
    }
}
