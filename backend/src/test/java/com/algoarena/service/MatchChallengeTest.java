package com.algoarena.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import java.io.InputStream;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;

/**
 * P0.5 - the client-safe view of a match challenge never contains answer-bearing data, for synthetic
 * canary data AND for every question in the six real question banks.
 */
class MatchChallengeTest {

    private static final ObjectMapper MAPPER = new ObjectMapper();
    private static final Set<String> FORBIDDEN_KEYS = Set.of(
            "correctAnswer", "answer", "answers", "explanation", "secret", "solution", "secretCode", "correct");

    private static final List<String> BANKS = List.of(
            "dsa-master-quiz", "logic-puzzle", "number-detective", "code-breaker");

    // ------------------------------------------------------------------ helpers

    static void assertNoForbiddenKeys(JsonNode node, String where) {
        if (node.isObject()) {
            node.fields().forEachRemaining(e -> {
                assertFalse(FORBIDDEN_KEYS.contains(e.getKey()), "forbidden key '" + e.getKey() + "' in " + where);
                assertNoForbiddenKeys(e.getValue(), where + "." + e.getKey());
            });
        } else if (node.isArray()) {
            for (int i = 0; i < node.size(); i++) {
                assertNoForbiddenKeys(node.get(i), where + "[" + i + "]");
            }
        }
    }

    private static Map<String, Object> canaryQuestion() {
        return Map.of(
                "id", "q1",
                "question", "Which is it?",
                "options", List.of("one", "two", "three"),
                "hint", "think",
                "correctAnswer", "CANARY-ANSWER",
                "explanation", "CANARY-EXPLANATION",
                "secret", "CANARY-SECRET",
                "meta", Map.of("solution", "CANARY-SOLUTION", "deeper", List.of(Map.of("answer", "CANARY-DEEP"))),
                "questions", List.of(Map.of("id", "sub", "choices", List.of("x", "y"), "answer", "CANARY-NESTED")));
    }

    // ------------------------------------------------------------------ synthetic canaries

    @Test
    void clientViewStripsEveryAnswerBearingFieldIncludingNestedOnes() throws Exception {
        String stored = MatchChallenge.create(List.of(canaryQuestion()));

        String client = MatchChallenge.toClientJson(stored);

        assertFalse(client.contains("CANARY"), "no canary value may reach the client: " + client);
        assertNoForbiddenKeys(MAPPER.readTree(client), "client");
    }

    @Test
    void clientViewKeepsEverythingNeededToPlay() throws Exception {
        JsonNode q = MAPPER.readTree(MatchChallenge.toClientJson(MatchChallenge.create(List.of(canaryQuestion())))).get(0);

        assertEquals("q1", q.get("id").asText());
        assertEquals("Which is it?", q.get("question").asText());
        assertEquals(3, q.get("options").size());
        assertEquals("think", q.get("hint").asText());
        assertEquals("sub", q.get("questions").get(0).get("id").asText());
        assertEquals(2, q.get("questions").get(0).get("choices").size());
    }

    @Test
    void serverKeepsTheAnswerForGrading() {
        MatchChallenge stored = MatchChallenge.parse(MatchChallenge.create(List.of(canaryQuestion())));

        assertEquals("CANARY-ANSWER", MatchChallenge.correctAnswerOf(stored.question(0)));
        assertEquals("CANARY-EXPLANATION", MatchChallenge.explanationOf(stored.question(0)));
    }

    @Test
    void recordedPlayerAnswersAreNeverPartOfTheClientView() {
        MatchChallenge challenge = MatchChallenge.parse(MatchChallenge.create(List.of(canaryQuestion())));
        challenge.record(MatchChallenge.P1, 0, "PLAYER-ONE-SECRET-GUESS", false, 1L);
        challenge.record(MatchChallenge.P2, 0, "PLAYER-TWO-SECRET-GUESS", true, 2L);

        String client = MatchChallenge.toClientJson(challenge.toJson());

        assertFalse(client.contains("PLAYER-ONE-SECRET-GUESS"));
        assertFalse(client.contains("PLAYER-TWO-SECRET-GUESS"));
        assertFalse(client.contains("\"answers\""));
    }

    @Test
    void legacyArrayFormatIsStillSanitisedAndReadable() throws Exception {
        String legacy = "[{\"question\":\"Q\",\"options\":[\"a\",\"b\"],\"correctAnswer\":\"LEGACY-CANARY\",\"explanation\":\"LEGACY-EXPL\"}]";

        String client = MatchChallenge.toClientJson(legacy);

        assertFalse(client.contains("LEGACY"));
        assertEquals("Q", MAPPER.readTree(client).get(0).get("question").asText());
        assertEquals(1, MatchChallenge.parse(legacy).questionCount());
        assertEquals("LEGACY-CANARY", MatchChallenge.correctAnswerOf(MatchChallenge.parse(legacy).question(0)));
    }

    @Test
    void unparseableOrEmptyDataFailsClosed() {
        assertEquals("[]", MatchChallenge.toClientJson("{broken"));
        assertEquals("[]", MatchChallenge.toClientJson(null));
        assertEquals("[]", MatchChallenge.toClientJson(""));
        assertEquals(0, MatchChallenge.parse("{broken").questionCount());
    }

    // ------------------------------------------------------------------ grading

    @Test
    void gradingIsDoneAgainstTheStoredAnswer() {
        JsonNode q = MatchChallenge.parse(MatchChallenge.create(List.of(Map.of(
                "options", List.of("O(1)", "O(n)"), "correctAnswer", "O(1)")))).question(0);

        assertTrue(MatchChallenge.isCorrect(q, "O(1)"));
        assertTrue(MatchChallenge.isCorrect(q, "  o(1) "));
        assertFalse(MatchChallenge.isCorrect(q, "O(n)"));
        assertFalse(MatchChallenge.isCorrect(q, ""));
        assertFalse(MatchChallenge.isCorrect(q, null));
    }

    @Test
    void storedLetterAnswersResolveAgainstOptions() {
        JsonNode q = MatchChallenge.parse(MatchChallenge.create(List.of(Map.of(
                "options", List.of("red", "green", "blue"), "correctAnswer", "C")))).question(0);

        assertTrue(MatchChallenge.isCorrect(q, "blue"));
        assertTrue(MatchChallenge.isCorrect(q, "C"));
        assertFalse(MatchChallenge.isCorrect(q, "red"));
    }

    @Test
    void codeBreakerStyleSecretIsGradedFromTheSecretField() {
        JsonNode q = MatchChallenge.parse(MatchChallenge.create(List.of(Map.of("secret", "042", "digitCount", 3)))).question(0);

        assertTrue(MatchChallenge.isCorrect(q, "042"));
        assertFalse(MatchChallenge.isCorrect(q, "420"));
    }

    // ------------------------------------------------------------------ the real question banks

    @Test
    void noQuestionInAnyRealBankLeaksAnythingThroughTheClientView() throws Exception {
        for (String bank : BANKS) {
            try (InputStream in = getClass().getClassLoader().getResourceAsStream("questions/" + bank + ".json")) {
                assertNotNull(in, "missing bank " + bank);
                List<Map<String, Object>> questions = MAPPER.readValue(in,
                        new com.fasterxml.jackson.core.type.TypeReference<List<Map<String, Object>>>() { });
                assertFalse(questions.isEmpty());

                String client = MatchChallenge.toClientJson(MatchChallenge.create(questions));
                JsonNode parsed = MAPPER.readTree(client);

                assertEquals(questions.size(), parsed.size(), bank);
                assertNoForbiddenKeys(parsed, bank);
            }
        }
    }

    @Test
    void realBanksStayPlayableAfterSanitising() throws Exception {
        for (String bank : List.of("dsa-master-quiz", "logic-puzzle", "number-detective")) {
            JsonNode first = firstClientQuestion(bank);
            assertTrue(first.hasNonNull("question"), bank + " question");
            assertTrue(first.path("options").isArray() && first.get("options").size() >= 2, bank + " options");
            assertTrue(first.hasNonNull("hint"), bank + " hint");
        }
        JsonNode codeBreaker = firstClientQuestion("code-breaker");
        assertTrue(codeBreaker.has("digitCount"));
        assertTrue(codeBreaker.path("clues").isArray() && codeBreaker.get("clues").size() > 0);
        assertTrue(codeBreaker.hasNonNull("hint"));
    }

    @Test
    void everyRealBankQuestionIsGradableByTheServer() throws Exception {
        for (String bank : BANKS) {
            try (InputStream in = getClass().getClassLoader().getResourceAsStream("questions/" + bank + ".json")) {
                List<Map<String, Object>> questions = MAPPER.readValue(in,
                        new com.fasterxml.jackson.core.type.TypeReference<List<Map<String, Object>>>() { });
                MatchChallenge stored = MatchChallenge.parse(MatchChallenge.create(questions));
                for (int i = 0; i < stored.questionCount(); i++) {
                    String expected = MatchChallenge.correctAnswerOf(stored.question(i));
                    assertFalse(expected.isEmpty(), bank + " #" + i + " has no gradable answer");
                    assertTrue(MatchChallenge.isCorrect(stored.question(i), expected), bank + " #" + i);
                }
            }
        }
    }

    private JsonNode firstClientQuestion(String bank) throws Exception {
        try (InputStream in = getClass().getClassLoader().getResourceAsStream("questions/" + bank + ".json")) {
            List<Map<String, Object>> questions = new ArrayList<>(MAPPER.readValue(in,
                    new com.fasterxml.jackson.core.type.TypeReference<List<Map<String, Object>>>() { }));
            return MAPPER.readTree(MatchChallenge.toClientJson(MatchChallenge.create(questions))).get(0);
        }
    }
}
