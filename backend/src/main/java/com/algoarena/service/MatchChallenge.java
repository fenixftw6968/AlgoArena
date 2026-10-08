package com.algoarena.service;

import com.algoarena.util.AnswerRedactor;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import lombok.extern.slf4j.Slf4j;

import java.util.List;
import java.util.Map;

/**
 * Server-side representation of a match's challenge, stored in {@code Match.challengeData}.
 *
 * <pre>
 * {"v":2, "questions":[ {...full question incl. correctAnswer/explanation...}, ... ],
 *         "answers":{ "p1":[{"i":0,"a":"text","c":true,"at":1700000000000}, ...], "p2":[...] }}
 * </pre>
 *
 * <p>This stored form is <b>server-only</b>: it contains the correct answers and every player's
 * recorded answers. Anything sent to a client must go through {@link #toClientJson(String)},
 * which strips every answer-bearing field. Legacy rows (a bare JSON array of questions) are read
 * transparently and are treated as "no answers recorded yet".
 */
@Slf4j
public final class MatchChallenge {

    public static final String P1 = "p1";
    public static final String P2 = "p2";

    private static final ObjectMapper MAPPER = new ObjectMapper();

    private final ArrayNode questions;
    private final ObjectNode answers;

    private MatchChallenge(ArrayNode questions, ObjectNode answers) {
        this.questions = questions;
        this.answers = answers;
    }

    // ------------------------------------------------------------------ construction / parsing

    /** Builds the stored form from a list of full (answer-bearing) question maps. */
    public static String create(List<Map<String, Object>> fullQuestions) {
        ArrayNode arr = MAPPER.valueToTree(fullQuestions == null ? List.of() : fullQuestions);
        return new MatchChallenge(arr, MAPPER.createObjectNode()).toJson();
    }

    /** Wraps an existing JSON array of full questions into the stored form. */
    public static String fromQuestionsJson(String questionsJson) {
        return parse(questionsJson).toJson();
    }

    /** Parses stored data (current or legacy format). Unparseable/blank input yields an empty challenge. */
    public static MatchChallenge parse(String raw) {
        if (raw == null || raw.isBlank()) {
            return empty();
        }
        try {
            JsonNode root = MAPPER.readTree(raw);
            if (root.isArray()) {
                return new MatchChallenge((ArrayNode) root, MAPPER.createObjectNode());
            }
            if (root.isObject() && root.path("questions").isArray()) {
                ObjectNode ans = root.path("answers").isObject()
                        ? (ObjectNode) root.get("answers") : MAPPER.createObjectNode();
                return new MatchChallenge((ArrayNode) root.get("questions"), ans);
            }
        } catch (Exception e) {
            log.warn("Could not parse match challenge data ({})", e.getClass().getSimpleName());
        }
        return empty();
    }

    private static MatchChallenge empty() {
        return new MatchChallenge(MAPPER.createArrayNode(), MAPPER.createObjectNode());
    }

    public String toJson() {
        ObjectNode root = MAPPER.createObjectNode();
        root.put("v", 2);
        root.set("questions", questions);
        root.set("answers", answers);
        return root.toString();
    }

    // ------------------------------------------------------------------ client-safe view

    /**
     * The only representation that may be sent to a client: a JSON array of the questions with every
     * answer-bearing key removed (recursively). Fails closed to {@code "[]"}.
     */
    public static String toClientJson(String raw) {
        try {
            ArrayNode copy = parse(raw).questions.deepCopy();
            AnswerRedactor.redact(copy);
            return copy.toString();
        } catch (Exception e) {
            log.warn("Could not build client-safe challenge ({})", e.getClass().getSimpleName());
            return "[]";
        }
    }

    // ------------------------------------------------------------------ questions

    public int questionCount() {
        return questions.size();
    }

    public JsonNode question(int index) {
        return questions.get(index);
    }

    /** The authoritative answer text of a question (never sent to clients before grading). */
    public static String correctAnswerOf(JsonNode question) {
        for (String key : new String[]{"correctAnswer", "answer", "secret"}) {
            if (question.hasNonNull(key) && !question.get(key).asText().isBlank()) {
                return question.get(key).asText().trim();
            }
        }
        return "";
    }

    public static String explanationOf(JsonNode question) {
        return question.hasNonNull("explanation") ? question.get("explanation").asText() : "";
    }

    /**
     * Server-side grading. A blank/null answer (e.g. a timeout) is always wrong. If the stored
     * answer is a single option letter (A-D) it is resolved against the question's options.
     */
    public static boolean isCorrect(JsonNode question, String given) {
        if (given == null || given.isBlank()) {
            return false;
        }
        String expected = correctAnswerOf(question);
        if (expected.isEmpty()) {
            return false;
        }
        String g = given.trim();
        List<String> options = new java.util.ArrayList<>();
        if (question.path("options").isArray()) {
            for (JsonNode o : question.get("options")) {
                options.add(o.asText().trim());
            }
        }
        // A stored letter (e.g. "C") means "the third option"; plain text answers compare directly.
        return g.equalsIgnoreCase(expected) || g.equalsIgnoreCase(resolveLetter(expected, options));
    }

    private static String resolveLetter(String value, List<String> options) {
        if (value.length() == 1 && !options.isEmpty()) {
            int idx = Character.toUpperCase(value.charAt(0)) - 'A';
            if (idx >= 0 && idx < options.size()) {
                return options.get(idx);
            }
        }
        return value;
    }

    // ------------------------------------------------------------------ recorded answers

    public int answeredCount(String slot) {
        return answers.path(slot).size();
    }

    public int correctCount(String slot) {
        int n = 0;
        for (JsonNode a : answers.path(slot)) {
            if (a.path("c").asBoolean(false)) {
                n++;
            }
        }
        return n;
    }

    /** The recorded answer for a question, or null if the player has not answered it yet. */
    public JsonNode recordedAnswer(String slot, int questionIndex) {
        JsonNode list = answers.path(slot);
        return questionIndex >= 0 && questionIndex < list.size() ? list.get(questionIndex) : null;
    }

    public void record(String slot, int questionIndex, String answer, boolean correct, long atMillis) {
        ArrayNode list = answers.has(slot) && answers.get(slot).isArray()
                ? (ArrayNode) answers.get(slot) : answers.putArray(slot);
        ObjectNode rec = MAPPER.createObjectNode();
        rec.put("i", questionIndex);
        rec.put("a", answer == null ? "" : answer);
        rec.put("c", correct);
        rec.put("at", atMillis);
        list.add(rec);
    }
}
