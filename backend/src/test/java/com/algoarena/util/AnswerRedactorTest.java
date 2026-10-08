package com.algoarena.util;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class AnswerRedactorTest {

    private final ObjectMapper mapper = new ObjectMapper();

    private JsonNode redact(String json) throws Exception {
        return mapper.readTree(AnswerRedactor.redactJson(json));
    }

    @Test
    void removesTopLevelAnswerBearingKeys() throws Exception {
        JsonNode out = redact("{\"question\":\"Q?\",\"answer\":\"A\",\"correctAnswer\":\"A\","
                + "\"explanation\":\"because\",\"solution\":\"S\",\"secretCode\":\"816\"}");

        assertEquals("Q?", out.get("question").asText());
        for (String key : new String[]{"answer", "correctAnswer", "explanation", "solution", "secretCode"}) {
            assertFalse(out.has(key), key + " must be removed");
        }
    }

    @Test
    void removesKeysRecursivelyInObjectsAndArrays() throws Exception {
        JsonNode out = redact("{\"steps\":[{\"text\":\"t1\",\"answer\":\"x\"},{\"text\":\"t2\",\"meta\":{\"Solution\":\"y\"}}],"
                + "\"nested\":{\"deeper\":{\"correct_answer\":\"z\",\"keep\":1}}}");

        assertFalse(out.get("steps").get(0).has("answer"));
        assertEquals("t1", out.get("steps").get(0).get("text").asText());
        assertFalse(out.get("steps").get(1).get("meta").has("Solution"));
        assertFalse(out.get("nested").get("deeper").has("correct_answer"));
        assertEquals(1, out.get("nested").get("deeper").get("keep").asInt());
    }

    @Test
    void keyMatchingIgnoresCaseAndPunctuation() throws Exception {
        JsonNode out = redact("{\"CORRECT-ANSWER\":\"a\",\"Correct Answer\":\"b\",\"correctIndex\":2,"
                + "\"correct_option\":1,\"safe\":true}");

        assertEquals(1, out.size());
        assertTrue(out.get("safe").asBoolean());
    }

    @Test
    void keepsLegitimateDisplayFields() throws Exception {
        JsonNode out = redact("{\"type\":\"mcq\",\"question\":\"Q\",\"options\":[\"a\",\"b\",\"c\",\"d\"],"
                + "\"choices\":[\"x\"],\"hint\":\"h\",\"tags\":[\"t\"],\"grid\":[[1,2],[3,4]],"
                + "\"description\":\"d\",\"statement\":\"s\"}");

        for (String key : new String[]{"type", "question", "options", "choices", "hint", "tags", "grid", "description", "statement"}) {
            assertTrue(out.has(key), key + " must be kept");
        }
        assertEquals(4, out.get("options").size());
    }

    @Test
    void doesNotRemoveValuesThatMerelyContainAnswerWords() throws Exception {
        // Only keys are inspected; a question text mentioning "answer" is legitimate content.
        JsonNode out = redact("{\"question\":\"What is the answer to everything?\",\"answerCount\":3}");

        assertTrue(out.has("question"));
        assertTrue(out.has("answerCount"));
    }

    @Test
    void invalidJsonFailsClosed() {
        assertEquals("{}", AnswerRedactor.redactJson("{not valid json"));
        assertEquals("{}", AnswerRedactor.redactJson(null));
        assertEquals("{}", AnswerRedactor.redactJson("   "));
    }

    @Test
    void nonObjectRootsPassThroughWithoutAnswers() throws Exception {
        assertEquals("[]", AnswerRedactor.redactJson("[]"));
        JsonNode arr = redact("[{\"answer\":\"x\",\"text\":\"t\"}]");
        assertFalse(arr.get(0).has("answer"));
        assertEquals("t", arr.get(0).get("text").asText());
    }
}
