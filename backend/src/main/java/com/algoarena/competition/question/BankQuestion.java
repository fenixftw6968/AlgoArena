package com.algoarena.competition.question;

import java.util.List;

/** One validated question as stored in the backend DSA bank (server side only). */
public record BankQuestion(String id, String difficulty, String category, String question,
                           List<String> options, String correctAnswer, String explanation) {
}
