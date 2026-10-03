import { shuffleArray } from '../utils/shuffleQuestions.js';
import { balanceAndRandomizeQuestionOptions } from '../utils/optionRandomizer.js';
import {
  getISTDate,
  getNextMidnightIST,
  getTimeUntilMidnightIST,
  getPastISTDates
} from '../utils/timezoneUtils.js';

const STORAGE_KEY_PREFIX = 'algoarena-daily';

// In-memory fallback for environments where window.localStorage is unavailable (e.g. tests/SSR)
let memoryStorage = {};

/**
 * Reads data from localStorage or memory fallback.
 * @param {string} key 
 * @returns {any}
 */
function readStorage(key) {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    }
    return memoryStorage[key] || null;
  } catch (e) {
    console.warn(`Failed to read storage for ${key}:`, e);
    return memoryStorage[key] || null;
  }
}

/**
 * Writes data to localStorage or memory fallback.
 * @param {string} key 
 * @param {any} value 
 */
function writeStorage(key, value) {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem(key, JSON.stringify(value));
    }
    memoryStorage[key] = value;
  } catch (e) {
    console.warn(`Failed to write storage for ${key}:`, e);
    memoryStorage[key] = value;
  }
}

/**
 * Computes a standardized date-based daily key for a game, difficulty tier, and IST date.
 * 
 * Format: algoarena-daily-<gameType>-<difficulty>-<YYYY-MM-DD>
 * Example: algoarena-daily-number-detective-easy-2026-08-22
 * 
 * @param {string} gameType 
 * @param {string} difficulty 
 * @param {string} [istDate] - defaults to current IST date
 * @returns {string}
 */
export function getDailyKey(gameType, difficulty = 'all', istDate = null) {
  const normGame = (gameType || 'generic').toLowerCase().trim();
  const normDiff = (difficulty || 'all').toLowerCase().trim();
  const dateStr = istDate || getISTDate();
  return `${STORAGE_KEY_PREFIX}-${normGame}-${normDiff}-${dateStr}`;
}

/**
 * Retrieves the live status and countdown until the next 12:00:00 AM IST reset.
 * 
 * @param {Date|number} [now=new Date()]
 * @returns {{ istDate: string, remainingMs: number, hours: number, minutes: number, seconds: number, formatted: string }}
 */
export function getDailyCountdown(now = new Date()) {
  return getTimeUntilMidnightIST(now);
}

/**
 * Gathers question IDs used across past days (yesterday, and past 3-7 days).
 * 
 * @param {string} gameType 
 * @param {string} difficulty 
 * @param {number} [daysCount=7]
 * @param {Date|number} [currentDate=new Date()]
 * @returns {{ yesterdayIds: Set<string>, pastDaysIds: Set<string>, historyByDate: Record<string, string[]> }}
 */
export function getRecentDailyHistory(gameType, difficulty, daysCount = 7, currentDate = new Date()) {
  const pastDates = getPastISTDates(daysCount, currentDate);
  const yesterdayDate = pastDates[0];
  const yesterdayIds = new Set();
  const pastDaysIds = new Set();
  const historyByDate = {};

  pastDates.forEach((dateStr, idx) => {
    const key = getDailyKey(gameType, difficulty, dateStr);
    const entry = readStorage(key);
    if (entry && Array.isArray(entry.questionIds)) {
      historyByDate[dateStr] = entry.questionIds.map(String);
      entry.questionIds.forEach(id => {
        const sId = String(id);
        pastDaysIds.add(sId);
        if (idx === 0) {
          yesterdayIds.add(sId);
        }
      });
    }
  });

  return { yesterdayIds, pastDaysIds, historyByDate, yesterdayDate };
}

/**
 * Retrieves or creates today's canonical Daily Question Pool for the given game and difficulty.
 * 
 * All players on the same calendar day in Asia/Kolkata receive questions from this EXACT pool.
 * Shuffling for individual user order is applied separately when requested.
 * 
 * @param {Object} params
 * @param {string} params.gameType - e.g. 'number-detective'
 * @param {string} [params.difficulty='all'] - 'easy' | 'medium' | 'hard' | 'all'
 * @param {Array} params.questionBank - Pool of available question objects
 * @param {number} [params.count=10] - Number of questions (default 10)
 * @param {boolean} [params.userShuffle=true] - Whether to shuffle the question order for this user session
 * @param {Date|number} [params.now=new Date()] - Evaluation time
 * @returns {Array} Array of question objects for today's daily challenge
 */
export function getDailyQuestionSet({
  gameType,
  difficulty = 'all',
  questionBank = [],
  count = 10,
  userShuffle = true,
  now = new Date()
} = {}) {
  if (!Array.isArray(questionBank) || questionBank.length === 0) {
    return [];
  }

  const currentDate = typeof now === 'number' ? new Date(now) : now;
  const todayIST = getISTDate(currentDate);
  const dailyKey = getDailyKey(gameType, difficulty, todayIST);
  const existing = readStorage(dailyKey);

  let poolQuestions = [];

  // 1. Check if today's canonical pool already exists in storage
  if (existing && Array.isArray(existing.questionIds) && existing.questionIds.length > 0) {
    const questionMap = new Map(questionBank.map(q => [String(q.id), q]));
    const matched = existing.questionIds
      .map(id => questionMap.get(String(id)))
      .filter(Boolean);

    if (matched.length === existing.questionIds.length) {
      poolQuestions = matched;
    }
  }

  // 2. If not generated yet for today's IST date, generate today's canonical pool
  if (poolQuestions.length === 0) {
    const normDiff = (difficulty || 'all').toLowerCase().trim();
    let eligible = questionBank;
    if (normDiff !== 'all') {
      eligible = questionBank.filter(
        q => q.difficulty && q.difficulty.toLowerCase() === normDiff
      );
      if (eligible.length === 0) {
        eligible = questionBank;
      }
    }

    // Retrieve past history (yesterday + past 3 to 7 days)
    const { yesterdayIds, pastDaysIds } = getRecentDailyHistory(gameType, difficulty, 7, currentDate);

    // Filter into buckets:
    // A) Fresh: not used in the past 7 days
    // B) Medium-fresh: used 2-7 days ago, but NOT yesterday
    // C) Yesterday: used yesterday
    const bucketFresh = eligible.filter(q => !pastDaysIds.has(String(q.id)));
    const bucketOlder = eligible.filter(q => pastDaysIds.has(String(q.id)) && !yesterdayIds.has(String(q.id)));
    const bucketYesterday = eligible.filter(q => yesterdayIds.has(String(q.id)));

    // Shuffle each candidate bucket with Fisher-Yates
    const shuffledFresh = shuffleArray(bucketFresh);
    const shuffledOlder = shuffleArray(bucketOlder);
    const shuffledYesterday = shuffleArray(bucketYesterday);

    let chosen = [];

    // Rule: Prefer fresh (no overlap in 7 days)
    if (shuffledFresh.length >= count) {
      chosen = shuffledFresh.slice(0, count);
    } else {
      // Take all fresh + fill from older days (2-7 days ago, excluding yesterday)
      chosen = [...shuffledFresh];
      const neededFromOlder = count - chosen.length;

      if (shuffledOlder.length >= neededFromOlder) {
        chosen.push(...shuffledOlder.slice(0, neededFromOlder));
      } else {
        // Take all older + only as last resort include yesterday's questions
        chosen.push(...shuffledOlder);
        const neededFromYesterday = count - chosen.length;
        chosen.push(...shuffledYesterday.slice(0, neededFromYesterday));
      }
    }

    // Ensure zero duplicates within the chosen set and shuffle canonical pool
    const uniqueChosen = Array.from(new Set(chosen));
    poolQuestions = shuffleArray(uniqueChosen).slice(0, count);

    // Save canonical pool to storage under today's fixed IST key
    const nextMidnightMs = getNextMidnightIST(currentDate);
    const entryData = {
      gameType: (gameType || 'generic').toLowerCase(),
      difficulty: normDiff,
      istDate: todayIST,
      questionIds: poolQuestions.map(q => String(q.id)),
      createdAt: currentDate.getTime(),
      expiresAt: nextMidnightMs
    };

    writeStorage(dailyKey, entryData);
  }

  // 3. Return question set (optionally user-shuffled for individual play order)
  // and randomize/balance options so correct answers don't repeat at the same option index
  const orderedQuestions = userShuffle ? shuffleArray([...poolQuestions]) : [...poolQuestions];
  return balanceAndRandomizeQuestionOptions(orderedQuestions);
}

/**
 * Forces regeneration of today's daily question set for a game & difficulty.
 */
export function forceRefreshDailySet({
  gameType,
  difficulty = 'all',
  questionBank = [],
  count = 10,
  now = new Date()
} = {}) {
  const currentDate = typeof now === 'number' ? new Date(now) : now;
  const todayIST = getISTDate(currentDate);
  const dailyKey = getDailyKey(gameType, difficulty, todayIST);

  // Clear today's key
  try {
    delete memoryStorage[dailyKey];
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.removeItem(dailyKey);
    }
  } catch (e) {}

  return getDailyQuestionSet({
    gameType,
    difficulty,
    questionBank,
    count,
    now: currentDate
  });
}

/**
 * Clears all cached daily question sets across all games and dates.
 */
export function clearAllDailySets() {
  try {
    memoryStorage = {};
    if (typeof window !== 'undefined' && window.localStorage) {
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(STORAGE_KEY_PREFIX)) {
          keysToRemove.push(k);
        }
      }
      keysToRemove.forEach(k => localStorage.removeItem(k));
    }
  } catch (e) {
    console.warn('Failed to clear daily questions storage:', e);
  }
}

/**
 * Sets up an automatic interval to detect when 12:00:00 AM IST passes.
 * When the IST date changes, triggers the provided callback.
 * 
 * @param {Function} onDateChange - callback(newISTDate, oldISTDate)
 * @returns {Function} cleanup function to clearInterval
 */
export function subscribeToMidnightIST(onDateChange) {
  let lastKnownDate = getISTDate();

  const intervalId = setInterval(() => {
    const currentDate = getISTDate();
    if (currentDate !== lastKnownDate) {
      const oldDate = lastKnownDate;
      lastKnownDate = currentDate;
      if (typeof onDateChange === 'function') {
        onDateChange(currentDate, oldDate);
      }
    }
  }, 1000);

  return () => clearInterval(intervalId);
}

export default {
  getDailyKey,
  getDailyQuestionSet,
  getDailyCountdown,
  getRecentDailyHistory,
  forceRefreshDailySet,
  clearAllDailySets,
  subscribeToMidnightIST
};
