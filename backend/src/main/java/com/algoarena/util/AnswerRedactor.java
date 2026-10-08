package com.algoarena.util;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import lombok.extern.slf4j.Slf4j;

import java.util.Iterator;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * Removes answer-bearing fields from JSON before it is sent to a client.
 *
 * <p>Keys are compared case-insensitively with every non-alphanumeric character ignored, so
 * {@code correctAnswer}, {@code correct_answer} and {@code CORRECT-ANSWER} are all treated alike.
 * Removal is recursive (nested objects and arrays). The helper <b>fails closed</b>: input that
 * cannot be parsed yields an empty JSON object rather than the original text.
 */
@Slf4j
public final class AnswerRedactor {

    /** Normalised (lower-case, alphanumerics only) names of fields that must never reach a client. */
    private static final Set<String> HIDDEN_KEYS = Set.of(
            "answer",
            "answers",
            "correctanswer",
            "correctoption",
            "correctoptions",
            "correctindex",
            "correctchoice",
            "solution",
            "solutions",
            "explanation",
            "secretcode",
            "secret",
            "rightanswer",
            "answerkey",
            "correct"
    );

    private static final ObjectMapper MAPPER = new ObjectMapper();

    private AnswerRedactor() {
    }

    /** Returns {@code json} with answer-bearing keys removed, or {@code "{}"} if it cannot be parsed. */
    public static String redactJson(String json) {
        if (json == null || json.isBlank()) {
            return "{}";
        }
        try {
            JsonNode root = MAPPER.readTree(json);
            if (root == null || root.isMissingNode()) {
                return "{}";
            }
            redact(root);
            return MAPPER.writeValueAsString(root);
        } catch (Exception e) {
            // Log only the exception type: the message could echo the (answer-bearing) payload.
            log.warn("Could not redact JSON payload ({}); returning empty object", e.getClass().getSimpleName());
            return "{}";
        }
    }

    /** Removes answer-bearing keys from the given tree in place. */
    public static void redact(JsonNode node) {
        if (node instanceof ObjectNode obj) {
            Iterator<Map.Entry<String, JsonNode>> fields = obj.fields();
            while (fields.hasNext()) {
                Map.Entry<String, JsonNode> field = fields.next();
                if (isHidden(field.getKey())) {
                    fields.remove();
                } else {
                    redact(field.getValue());
                }
            }
        } else if (node instanceof ArrayNode arr) {
            for (JsonNode element : arr) {
                redact(element);
            }
        }
    }

    static boolean isHidden(String key) {
        if (key == null) {
            return false;
        }
        StringBuilder normalised = new StringBuilder(key.length());
        for (int i = 0; i < key.length(); i++) {
            char c = key.charAt(i);
            if (Character.isLetterOrDigit(c)) {
                normalised.append(Character.toLowerCase(c));
            }
        }
        return HIDDEN_KEYS.contains(normalised.toString().toLowerCase(Locale.ROOT));
    }
}
