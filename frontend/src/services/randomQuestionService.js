import { shuffleArray } from '../utils/shuffleQuestions.js';
import { balanceAndRandomizeQuestionOptions } from '../utils/optionRandomizer.js';
import { selectQuestionsForGame, fetchUserQuestionHistory, recordUserQuestions, resetUserQuestionHistory } from './questionHistoryService.js';

export { selectQuestionsForGame, fetchUserQuestionHistory, recordUserQuestions, resetUserQuestionHistory };

const STORAGE_KEY_PREFIX = 'algoarena-recent-played';
const RECENT_MEMORY_SIZE = 50; // Remember last 50 questions per game/difficulty

function readStorage(key) {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : [];
    }
    return [];
  } catch (e) {
    console.warn(`Failed to read storage for ${key}:`, e);
    return [];
  }
}

function writeStorage(key, value) {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem(key, JSON.stringify(value));
    }
  } catch (e) {
    console.warn(`Failed to write storage for ${key}:`, e);
  }
}

export function getRandomQuestionSet({
  gameType,
  difficulty = 'all',
  questionBank = [],
  count = null,
  userShuffle = true
} = {}) {
  if (!Array.isArray(questionBank) || questionBank.length === 0) {
    return [];
  }

  const normGame = (gameType || 'generic').toLowerCase().trim();
  const normDiff = (difficulty || 'all').toLowerCase().trim();
  const effectiveCount = (count !== null && count > 0)
    ? count
    : (normGame === 'dsa-master-quiz' || normGame === 'number-detective' ? 5 : 10);
  const key = `${STORAGE_KEY_PREFIX}-${normGame}-${normDiff}`;
  
  let eligible = questionBank;
  if (normDiff !== 'all') {
    const matching = questionBank.filter(
      q => q.difficulty && q.difficulty.toLowerCase() === normDiff
    );
    if (matching.length > 0) {
      eligible = matching;
    }
  }

  const recentlyPlayedIds = new Set(readStorage(key));

  const bucketFresh = eligible.filter(q => !recentlyPlayedIds.has(String(q.id)));
  const bucketPlayed = eligible.filter(q => recentlyPlayedIds.has(String(q.id)));

  const shuffledFresh = shuffleArray(bucketFresh);
  const shuffledPlayed = shuffleArray(bucketPlayed);

  const chosen = [];
  const seenIds = new Set();
  const seenTexts = new Set();

  function tryAdd(q) {
    if (!q) return false;
    const qId = String(q.id);
    const qText = (q.question || q.title || '').trim().toLowerCase();
    if (!seenIds.has(qId) && (!qText || !seenTexts.has(qText))) {
      seenIds.add(qId);
      if (qText) seenTexts.add(qText);
      chosen.push(q);
      return true;
    }
    return false;
  }

  for (const q of shuffledFresh) {
    if (chosen.length >= effectiveCount) break;
    tryAdd(q);
  }

  if (chosen.length < effectiveCount) {
    for (const q of shuffledPlayed) {
      if (chosen.length >= effectiveCount) break;
      tryAdd(q);
    }
  }

  if (chosen.length < effectiveCount) {
    for (const q of shuffleArray([...eligible])) {
      if (chosen.length >= effectiveCount) break;
      tryAdd(q);
    }
  }

  // Update recently played
  const newRecentIds = [...readStorage(key), ...chosen.map(q => String(q.id))];
  if (newRecentIds.length > RECENT_MEMORY_SIZE) {
    newRecentIds.splice(0, newRecentIds.length - RECENT_MEMORY_SIZE);
  }
  writeStorage(key, newRecentIds);

  const orderedQuestions = userShuffle ? shuffleArray([...chosen]) : [...chosen];
  return balanceAndRandomizeQuestionOptions(orderedQuestions);
}

export async function getRandomQuestionSetAsync(options = {}) {
  return selectQuestionsForGame({
    gameSlug: options.gameType,
    difficulty: options.difficulty,
    questionBank: options.questionBank,
    count: options.count,
    userShuffle: options.userShuffle !== false
  });
}

