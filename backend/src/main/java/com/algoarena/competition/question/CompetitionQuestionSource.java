package com.algoarena.competition.question;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

/**
 * Server-side source of competition questions: the backend copy of the DSA Master Quiz bank
 * ({@code questions/dsa-master-quiz.json} on the classpath). The competition never reads, trusts or depends on
 * the frontend's copy of the questions.
 *
 * <p>The bank is loaded once, lazily, and <b>validated strictly</b> (unique ids, exactly distinct options, the
 * stated answer is one of them) - a malformed bank fails loudly instead of producing an ungradable contest.
 */
@Component
@ConditionalOnProperty(prefix = "competition", name = "enabled", havingValue = "true")
public class CompetitionQuestionSource {

    static final String RESOURCE = "questions/dsa-master-quiz.json";

    private final ObjectMapper objectMapper;
    private volatile List<BankQuestion> cache;

    public CompetitionQuestionSource(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    public List<BankQuestion> all() {
        List<BankQuestion> local = cache;
        if (local == null) {
            synchronized (this) {
                local = cache;
                if (local == null) {
                    local = List.copyOf(load());
                    cache = local;
                }
            }
        }
        return local;
    }

    private List<BankQuestion> load() {
        try (InputStream in = getClass().getClassLoader().getResourceAsStream(RESOURCE)) {
            if (in == null) {
                throw new IllegalStateException("Question bank not found on the classpath: " + RESOURCE);
            }
            return parse(objectMapper.readTree(in));
        } catch (IOException e) {
            throw new IllegalStateException("Could not read the question bank", e);
        }
    }

    /** Visible for tests: parses and validates a bank document. */
    List<BankQuestion> parse(JsonNode root) {
        if (!root.isArray() || root.isEmpty()) {
            throw new IllegalStateException("Question bank must be a non-empty JSON array");
        }
        List<BankQuestion> out = new ArrayList<>();
        Set<String> ids = new HashSet<>();
        for (JsonNode q : root) {
            String id = text(q, "id");
            String question = text(q, "question");
            String answer = text(q, "correctAnswer");
            if (id.isEmpty() || question.isEmpty() || answer.isEmpty()) {
                throw new IllegalStateException("Question bank entry is missing id/question/correctAnswer: " + id);
            }
            if (!ids.add(id)) {
                throw new IllegalStateException("Duplicate question id in bank: " + id);
            }
            if (!q.path("options").isArray() || q.get("options").size() < 2) {
                throw new IllegalStateException("Question needs at least two options: " + id);
            }
            List<String> options = new ArrayList<>();
            Set<String> distinct = new HashSet<>();
            for (JsonNode o : q.get("options")) {
                String option = o.asText().trim();
                if (option.isEmpty() || !distinct.add(option.toLowerCase(Locale.ROOT))) {
                    throw new IllegalStateException("Empty or duplicate option in question: " + id);
                }
                options.add(option);
            }
            if (options.stream().noneMatch(o -> o.equalsIgnoreCase(answer))) {
                throw new IllegalStateException("Correct answer is not one of the options in question: " + id);
            }
            out.add(new BankQuestion(id, text(q, "difficulty").toUpperCase(Locale.ROOT), text(q, "category"),
                    question, List.copyOf(options), answer, text(q, "explanation")));
        }
        return out;
    }

    private static String text(JsonNode node, String field) {
        return node.hasNonNull(field) ? node.get(field).asText().trim() : "";
    }
}
