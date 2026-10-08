import api from '../utils/api';

/**
 * Sends ONE answer of a 1v1 match to the server, which is the only authority on correctness,
 * score and timing. The response reveals the right answer / explanation for that question only
 * after the answer has been recorded:
 *   { correct, correctAnswer, explanation, questionIndex, answeredCount, totalQuestions,
 *     alreadyAnswered, finished, match }
 *
 * Pass `null` as the answer for a timeout / skipped question (graded as wrong).
 */
export async function submitMatchAnswer(matchId, questionIndex, answer) {
  const res = await api.post(`/api/matches/${matchId}/answers`, {
    questionIndex,
    answer: answer === undefined ? null : answer,
  });
  return res.data;
}

/** Friendly message for a rejected/failed answer request. */
export function describeAnswerError(error) {
  return error?.response?.data?.message || 'Could not submit your answer. Please try again.';
}
