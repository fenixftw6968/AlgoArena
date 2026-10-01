import api from '../utils/api.js';
import { shuffleArray } from '../utils/shuffleQuestions.js';
import { balanceAndRandomizeQuestionOptions } from '../utils/optionRandomizer.js';

/**
 * Checks whether an authenticated JWT token is present.
 */
export function isAuthenticated() {
  if (typeof window === 'undefined' || !window.localStorage) return false;
  const token = localStorage.getItem('mm_token');
  return !!token && token.trim().length > 0;
}

/**
 * Selects questions for a game session using the server database as the source of truth.
 * Ensures cross-device and cross-computer question synchronization.
 * Supports both object params and positional arguments.
 */
export async function selectQuestionsForGame(optionsOrSlug, optDifficulty, optBank, optCount, optShuffle) {
  let gameSlug, difficulty, questionBank, count, userShuffle;

  const normGame = (gameSlug || 'generic').toLowerCase().trim();
  const normDiff = (difficulty || 'all').toLowerCase().trim();
  const defaultCount = (normGame === 'dsa-master-quiz' || normGame === 'number-detective') ? 5 : 10;

  if (typeof optionsOrSlug === 'object' && optionsOrSlug !== null) {
    ({
      gameSlug,
      difficulty = 'all',
      questionBank = [],
      count = defaultCount,
      userShuffle = true
    } = optionsOrSlug);
  } else {
    gameSlug = optionsOrSlug;
    difficulty = optDifficulty || 'all';
    questionBank = optBank || [];
    count = optCount || defaultCount;
    userShuffle = optShuffle !== undefined ? optShuffle : true;
  }

  if (!Array.isArray(questionBank) || questionBank.length === 0) {
    return [];
  }

  // 1. Filter by difficulty if specified
  let eligible = questionBank;
  if (normDiff !== 'all') {
    const matching = questionBank.filter(
      q => q.difficulty && q.difficulty.toLowerCase() === normDiff
    );
    if (matching.length > 0) {
      eligible = matching;
    }
  }

  if (eligible.length === 0) {
    eligible = questionBank;
  }

  // Helper to test if question is already in selected
  const seenIds = new Set();
  const seenTexts = new Set();
  const isUniqueCandidate = (q) => {
    if (!q) return false;
    const qId = String(q.id);
    const qText = (q.question || q.title || '').trim().toLowerCase();
    if (seenIds.has(qId)) return false;
    if (qText && seenTexts.has(qText)) return false;
    return true;
  };
  const markAdded = (q) => {
    seenIds.add(String(q.id));
    const qText = (q.question || q.title || '').trim().toLowerCase();
    if (qText) seenTexts.add(qText);
  };

  // Create lookup map by string ID
  const poolMap = new Map();
  eligible.forEach(q => poolMap.set(String(q.id), q));

  // 2. If authenticated, request selection from the backend with strict timeout
  if (isAuthenticated()) {
    try {
      // Deduplicate candidates before sending
      const candidateIds = Array.from(new Set(eligible.map(q => String(q.id))));
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1800);

      const res = await api.post('/api/question-history/select', {
        gameSlug: normGame,
        difficulty: normDiff,
        candidateIds: candidateIds,
        count: count
      }, {
        signal: controller.signal,
        timeout: 1800
      });
      clearTimeout(timeoutId);

      if (res.data && Array.isArray(res.data.selectedIds) && res.data.selectedIds.length > 0) {
        const selected = [];
        for (const id of res.data.selectedIds) {
          const q = poolMap.get(String(id));
          if (q && isUniqueCandidate(q)) {
            markAdded(q);
            selected.push(q);
          }
        }

        // If server selected fewer than needed, fill remainder strictly with unique questions
        if (selected.length < count) {
          const remainder = eligible.filter(isUniqueCandidate);
          const extra = shuffleArray(remainder).slice(0, count - selected.length);
          for (const eq of extra) {
            markAdded(eq);
            selected.push(eq);
          }
        }

        if (selected.length > 0) {
          const finalQuestions = userShuffle ? shuffleArray([...selected]) : [...selected];
          return balanceAndRandomizeQuestionOptions(finalQuestions);
        }
      }
    } catch (err) {
      console.warn('Server question selection skipped or timed out, using fast local pool selection:', err.message || err);
    }
  }

  // 3. Guest / Offline / Fast Fallback: Local shuffle selection with strict uniqueness
  const shuffled = shuffleArray([...eligible]);
  const fallbackSelection = [];
  for (const q of shuffled) {
    if (fallbackSelection.length >= count) break;
    if (isUniqueCandidate(q)) {
      markAdded(q);
      fallbackSelection.push(q);
    }
  }
  const ordered = userShuffle ? shuffleArray([...fallbackSelection]) : fallbackSelection;
  return balanceAndRandomizeQuestionOptions(ordered);
}

/**
 * Fetches the user's used question history from the backend.
 */
export async function fetchUserQuestionHistory(gameSlug, difficulty = 'all') {
  if (!isAuthenticated()) return [];
  try {
    const res = await api.get('/api/question-history', {
      params: {
        gameSlug: (gameSlug || '').toLowerCase().trim(),
        difficulty: (difficulty || 'all').toUpperCase().trim()
      }
    });
    return res.data?.usedQuestionIds || [];
  } catch (err) {
    console.warn('Failed to fetch question history from server:', err);
    return [];
  }
}

/**
 * Manually records questions as used on the server.
 */
export async function recordUserQuestions(gameSlug, difficulty = 'all', questionIds = []) {
  if (!isAuthenticated() || !Array.isArray(questionIds) || questionIds.length === 0) return;
  try {
    await api.post('/api/question-history/record', {
      gameSlug: (gameSlug || '').toLowerCase().trim(),
      difficulty: (difficulty || 'all').toUpperCase().trim(),
      questionIds: questionIds.map(String)
    });
  } catch (err) {
    console.warn('Failed to record question history on server:', err);
  }
}

/**
 * Manually resets question history cycle on the server.
 */
export async function resetUserQuestionHistory(gameSlug, difficulty = 'all') {
  if (!isAuthenticated()) return;
  try {
    await api.delete('/api/question-history/reset', {
      params: {
        gameSlug: (gameSlug || '').toLowerCase().trim(),
        difficulty: (difficulty || 'all').toUpperCase().trim()
      }
    });
  } catch (err) {
    console.warn('Failed to reset question history on server:', err);
  }
}

export default {
  selectQuestionsForGame,
  fetchUserQuestionHistory,
  recordUserQuestions,
  resetUserQuestionHistory,
  isAuthenticated
};
