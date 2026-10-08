package com.algoarena.competition;

import com.algoarena.competition.domain.Competition;
import com.algoarena.competition.repository.CompetitionRepository;
import com.algoarena.competition.service.CompetitionFacade;
import com.algoarena.competition.service.CompetitionLifecycleService;
import com.algoarena.competition.service.CompetitionLobbyService;
import com.algoarena.competition.support.AbstractCompetitionDbTest;
import com.algoarena.competition.ws.CompetitionEventPublisher.Envelope;
import com.algoarena.entity.User;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.atLeastOnce;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

/**
 * D5: nothing that reveals a correct answer may leave the server before the competition is FINISHED - neither in
 * REST bodies nor in WebSocket events. Also checks events are published only after commit.
 */
class CompetitionLeakAndEventsTest extends AbstractCompetitionDbTest {

    private static final List<String> FORBIDDEN = List.of("correctindex", "correct_index", "correctoption", "correctanswer",
            "explanation", "answerkey", "source_id", "sourceid", "password", "email", "userid");

    @Autowired CompetitionLobbyService lobby;
    @Autowired CompetitionLifecycleService lifecycle;
    @Autowired CompetitionFacade facade;
    @Autowired CompetitionRepository competitions;

    private final ObjectMapper json = new ObjectMapper().registerModule(new JavaTimeModule());

    private String serialize(Object o) throws Exception {
        return json.writeValueAsString(o).toLowerCase(Locale.ROOT);
    }

    private void assertNoLeak(String body, String where) {
        for (String word : FORBIDDEN) {
            assertFalse(body.contains(word), where + " must not contain '" + word + "': " + body);
        }
    }

    private int correctIndex(Long id, int number) {
        return jdbc.queryForObject("SELECT correct_index FROM competition_questions WHERE competition_id = ? AND question_number = ?", Integer.class, id, number);
    }

    @Test
    void noRestResponseBeforeTheEndCarriesAnythingThatRevealsAnAnswer() throws Exception {
        User host = newUser("host");
        User guest = newUser("guest");
        Competition c = lobby.create(host);
        assertNoLeak(serialize(facade.state(c.getId(), host)), "lobby state");
        lobby.join(c.getId(), guest);
        assertNoLeak(serialize(facade.openLobbies(0, 20)), "lobby list");
        lobby.start(c.getId(), host);
        advance(10);
        lifecycle.advance(c.getId());

        String questions = serialize(facade.questions(c.getId(), host));
        assertNoLeak(questions, "questions");
        assertTrue(questions.contains("\"options\""));

        assertNoLeak(serialize(facade.submit(c.getId(), host, 1, correctIndex(c.getId(), 1))), "correct submission result");
        assertNoLeak(serialize(facade.submit(c.getId(), host, 2, (correctIndex(c.getId(), 2) + 1) % 4)), "wrong submission result");
        assertNoLeak(serialize(facade.state(c.getId(), host)), "running state (with my answers)");
        assertNoLeak(serialize(facade.state(c.getId(), guest)), "running state of another player");
        assertNoLeak(serialize(facade.finish(c.getId(), host)), "finish result");
    }

    @Test
    void aWrongAnswerDoesNotRevealWhichOptionWasRight() throws Exception {
        User host = newUser("host");
        Competition c = lobby.create(host);
        lobby.join(c.getId(), newUser("guest"));
        lobby.start(c.getId(), host);
        advance(10);
        lifecycle.advance(c.getId());

        var wrong = facade.submit(c.getId(), host, 1, (correctIndex(c.getId(), 1) + 1) % 4);

        assertFalse(wrong.correct());
        // the verdict record has no field that could carry the right option
        assertEquals(List.of("questionNumber", "correct", "scoreAwarded", "totalScore", "answeredCount", "alreadySubmitted", "finished", "serverTime"),
                java.util.Arrays.stream(wrong.getClass().getRecordComponents()).map(rc -> rc.getName()).toList());
    }

    @Test
    void theStatePollingOfAnotherPlayerDoesNotExposeMyAnswersOrScore() throws Exception {
        User host = newUser("host");
        User guest = newUser("guest");
        Competition c = lobby.create(host);
        lobby.join(c.getId(), guest);
        lobby.start(c.getId(), host);
        advance(10);
        lifecycle.advance(c.getId());
        facade.submit(c.getId(), host, 1, correctIndex(c.getId(), 1));

        var guestView = facade.state(c.getId(), guest);

        assertEquals(0, guestView.me().score());
        assertTrue(guestView.me().answers().isEmpty());
        assertTrue(guestView.players().stream().allMatch(p -> p.status() != null));
        String body = serialize(guestView);
        assertFalse(body.contains("\"score\":100"), "another player's score is not visible: " + body);
    }

    @Test
    void everyPublishedEventIsFreeOfAnswersAndPrivateData() throws Exception {
        User host = newUser("host");
        User guest = newUser("guest");
        Competition c = lobby.create(host);
        lobby.join(c.getId(), guest);
        lobby.start(c.getId(), host);
        advance(10);
        lifecycle.advance(c.getId());
        facade.submit(c.getId(), host, 1, correctIndex(c.getId(), 1));
        facade.finish(c.getId(), host);
        facade.finish(c.getId(), guest);

        ArgumentCaptor<Object> payloads = ArgumentCaptor.forClass(Object.class);
        verify(stomp, atLeastOnce()).convertAndSend(anyString(), payloads.capture());
        List<String> types = new ArrayList<>();
        for (Object payload : payloads.getAllValues()) {
            Envelope e = (Envelope) payload;
            types.add(e.type());
            assertNoLeak(serialize(e), "event " + e.type());
            assertEquals(c.getId(), e.competitionId());
        }
        assertTrue(types.containsAll(List.of("LOBBY_UPDATED", "COMPETITION_STARTING", "COMPETITION_STARTED", "PLAYER_FINISHED", "COMPETITION_ENDED")), types.toString());
    }

    @Test
    void eventVersionsNeverGoBackwardsForStateChangingEvents() {
        User host = newUser("host");
        User guest = newUser("guest");
        Competition c = lobby.create(host);
        lobby.join(c.getId(), guest);
        lobby.start(c.getId(), host);
        advance(10);
        lifecycle.advance(c.getId());
        facade.finish(c.getId(), host);
        facade.finish(c.getId(), guest);

        ArgumentCaptor<Object> payloads = ArgumentCaptor.forClass(Object.class);
        verify(stomp, atLeastOnce()).convertAndSend(anyString(), payloads.capture());
        long last = -1;
        for (Object payload : payloads.getAllValues()) {
            Envelope e = (Envelope) payload;
            assertTrue(e.version() >= last, e.type() + " went backwards: " + e.version() + " < " + last);
            last = e.version();
        }
    }

    @Test
    void eventsOfAFailedTransactionAreNeverPublished() {
        User host = newUser("host");
        Competition c = lobby.create(host);
        org.mockito.Mockito.reset(stomp);

        // starting with one player is rejected -> the transaction rolls back and nothing may be broadcast
        assertThrows(RuntimeException.class, () -> lobby.start(c.getId(), host));

        verify(stomp, never()).convertAndSend(anyString(), org.mockito.ArgumentMatchers.<Object>any());
    }

    @Test
    void eventsGoOnlyToTheCompetitionsOwnTopic() {
        User host = newUser("host");
        Competition c = lobby.create(host);
        lobby.join(c.getId(), newUser("guest"));

        ArgumentCaptor<String> destinations = ArgumentCaptor.forClass(String.class);
        verify(stomp, atLeastOnce()).convertAndSend(destinations.capture(), org.mockito.ArgumentMatchers.<Object>any());
        assertTrue(destinations.getAllValues().stream().allMatch(d -> d.equals("/topic/competition/" + c.getId())), destinations.getAllValues().toString());
    }
}
