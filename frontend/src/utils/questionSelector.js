import { shuffleArray } from './shuffleQuestions.js';
import { balanceAndRandomizeQuestionOptions } from './optionRandomizer.js';
import { getDailyQuestionSet, getDailyCountdown } from '../services/dailyQuestionService.js';
import { selectQuestionsForGame } from '../services/questionHistoryService.js';

const STORAGE_PREFIX = 'algoarena_recent_questions_';

/**
 * Retrieves the list of recently played question IDs from localStorage.
 * @param {string} gameType 
 * @returns {string[]}
 */
export function getRecentQuestionIds(gameType) {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return [];
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${gameType}`);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.warn(`Failed to read recent questions for ${gameType}:`, e);
    return [];
  }
}

/**
 * Saves a list of played question IDs to localStorage.
 * @param {string} gameType 
 * @param {string[]} newIds 
 * @param {number} maxKeep - Max IDs to retain in history to keep storage clean
 */
export function saveRecentQuestionIds(gameType, newIds, maxKeep = 50) {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    const existing = getRecentQuestionIds(gameType);
    const combined = Array.from(new Set([...existing, ...newIds]));
    // Keep most recent maxKeep IDs
    const trimmed = combined.slice(-maxKeep);
    localStorage.setItem(`${STORAGE_PREFIX}${gameType}`, JSON.stringify(trimmed));
  } catch (e) {
    console.warn(`Failed to save recent questions for ${gameType}:`, e);
  }
}

/**
 * Clears recent question history for a game.
 * @param {string} gameType 
 */
export function clearRecentQuestionIds(gameType) {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    localStorage.removeItem(`${STORAGE_PREFIX}${gameType}`);
  } catch (e) {
    console.warn(`Failed to clear recent questions for ${gameType}:`, e);
  }
}

/**
 * Selects randomized, non-repeating questions for a game session.
 * Prioritizes questions that the user has not recently played.
 * 
 * @param {Array} questionBank - All questions for the game
 * @param {Object} options
 * @param {string} options.gameType - Unique identifier for the game
 * @param {string} [options.difficulty='all'] - 'easy' | 'medium' | 'hard' | 'all' (case-insensitive)
 * @param {number} [options.count=10] - Number of questions to return
 * @param {boolean} [options.recordHistory=true] - Whether to record selected IDs in localStorage
 * @returns {Array} Shuffled array of selected questions
 */
export function selectQuestions(questionBank, {
  gameType,
  difficulty = 'all',
  count = null,
  recordHistory = true,
} = {}) {
  if (!Array.isArray(questionBank) || questionBank.length === 0) {
    return [];
  }

  const normGame = (gameType || 'generic').toLowerCase().trim();
  const effectiveCount = (count !== null && count > 0)
    ? count
    : (normGame === 'dsa-master-quiz' || normGame === 'number-detective' || normGame === 'logic-puzzle' ? 5 : 10);

  // 1. Filter by difficulty if specified and not 'all'
  let eligible = questionBank;
  if (difficulty && difficulty.toLowerCase() !== 'all') {
    const matching = questionBank.filter(
      q => q.difficulty && q.difficulty.toLowerCase() === difficulty.toLowerCase()
    );
    // If no questions match the specific difficulty, fall back to entire pool
    if (matching.length > 0) {
      eligible = matching;
    }
  }

  // 2. Fetch recently played question IDs
  const recentIds = new Set(getRecentQuestionIds(gameType));

  // 3. Separate questions into fresh (unplayed) and recently played
  const unplayed = eligible.filter(q => !recentIds.has(q.id));
  const played = eligible.filter(q => recentIds.has(q.id));

  // 4. Shuffle both groups with Fisher-Yates
  const shuffledUnplayed = shuffleArray(unplayed);
  const shuffledPlayed = shuffleArray(played);

  // 5. Combine: Pick from unplayed first, and if we still need more, pick from played, guaranteeing strictly unique questions
  const selected = [];
  const seenIds = new Set();
  const seenTexts = new Set();

  function tryAdd(q) {
    if (!q) return false;
    const qId = String(q.id);
    const qText = (q.question || q.title || '').trim().toLowerCase();
    if (!seenIds.has(qId) && (!qText || !seenTexts.has(qText))) {
      seenIds.add(qId);
      if (qText) seenTexts.add(qText);
      selected.push(q);
      return true;
    }
    return false;
  }

  for (const q of shuffledUnplayed) {
    if (selected.length >= effectiveCount) break;
    tryAdd(q);
  }

  if (selected.length < effectiveCount) {
    for (const q of shuffledPlayed) {
      if (selected.length >= effectiveCount) break;
      tryAdd(q);
    }
    if (unplayed.length === 0) {
      clearRecentQuestionIds(gameType);
    }
  }

  // If still need more from eligible pool (e.g. initial set), try adding remaining unique
  if (selected.length < effectiveCount) {
    for (const q of shuffleArray([...eligible])) {
      if (selected.length >= effectiveCount) break;
      tryAdd(q);
    }
  }

  // Ensure overall array is shuffled so unplayed/played aren't clustered
  const finalOrdered = shuffleArray(selected);

  // 6. Record played IDs in history
  if (recordHistory && finalOrdered.length > 0) {
    const selectedIds = finalOrdered.map(q => q.id);
    saveRecentQuestionIds(gameType, selectedIds);
  }

  return balanceAndRandomizeQuestionOptions(finalOrdered);
}

/**
 * Convenience wrapper to fetch the fixed 12:00 AM IST daily question set.
 */
export function selectDailyQuestions(questionBank, {
  gameType,
  difficulty = 'all',
  count = 10,
  userShuffle = true,
  now = new Date()
} = {}) {
  return getDailyQuestionSet({
    gameType,
    difficulty,
    questionBank,
    count,
    userShuffle,
    now
  });
}

export async function selectQuestionsAsync(questionBank, options = {}) {
  return selectQuestionsForGame({
    gameSlug: options.gameType,
    difficulty: options.difficulty,
    questionBank: questionBank,
    count: options.count,
    userShuffle: true
  });
}

export { selectQuestionsForGame };
export { getDailyQuestionSet, getDailyCountdown };
export { validateAnswerDistribution } from './optionRandomizer.js';
export default selectQuestions;

