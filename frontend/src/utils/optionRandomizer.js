import { shuffleArray } from './shuffleQuestions.js';

/**
 * Creates a pseudo-random number generator function deterministic to a seed string.
 * Ensures cross-player synchronization during multiplayer matches.
 * 
 * @param {string|number} seedStr 
 * @returns {() => number}
 */
export function createSeededRandom(seedStr) {
  if (!seedStr) return Math.random;
  const str = String(seedStr);
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return function() {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

function resolveRandomFn(randomFnOrSeed) {
  if (typeof randomFnOrSeed === 'function') return randomFnOrSeed;
  if (typeof randomFnOrSeed === 'string' || typeof randomFnOrSeed === 'number') {
    return createSeededRandom(String(randomFnOrSeed));
  }
  return Math.random;
}

/**
 * Creates a balanced array of target option indices (e.g. 0 for A, 1 for B, 2 for C, 3 for D)
 * distributed as evenly as possible across the total question count.
 * 
 * @param {number} questionCount - Total number of questions in session (e.g. 10)
 * @param {number} [optionCount=4] - Total choices per question (e.g. 4)
 * @param {Function|string|number} [randomFnOrSeed=Math.random]
 * @returns {number[]} Array of target 0-based indices for each question
 */
export function createBalancedAnswerPositions(questionCount, optionCount = 4, randomFnOrSeed = Math.random) {
  if (questionCount <= 0 || optionCount <= 0) return [];
  const rng = resolveRandomFn(randomFnOrSeed);
  
  const baseCount = Math.floor(questionCount / optionCount);
  const remainder = questionCount % optionCount;
  
  const positions = [];
  for (let i = 0; i < optionCount; i++) {
    const countForPosition = baseCount + (i < remainder ? 1 : 0);
    for (let c = 0; c < countForPosition; c++) {
      positions.push(i);
    }
  }
  
  return shuffleArray(positions, rng);
}

/**
 * Generates and validates an array of unique choices with the correct answer
 * placed exactly at the assigned target index.
 * 
 * @template T
 * @param {T} correctAnswer - The correct answer value or object
 * @param {T[]} incorrectAnswers - Array of distinct incorrect answer options
 * @param {number} targetPosition - 0-indexed position where the correct answer MUST be placed
 * @param {Function|string|number} [randomFnOrSeed=Math.random]
 * @returns {T[]} Array of options with the correct answer at targetPosition
 */
export function generateQuestionOptions(correctAnswer, incorrectAnswers, targetPosition = 0, randomFnOrSeed = Math.random) {
  const rng = resolveRandomFn(randomFnOrSeed);
  
  const getIdentifier = (item) => {
    if (!item) return '';
    if (typeof item === 'object') {
      return item.id !== undefined ? String(item.id) : (item.label || JSON.stringify(item));
    }
    return String(item).trim().toLowerCase();
  };

  const correctId = getIdentifier(correctAnswer);
  
  // Deduplicate and filter out correct answer from incorrect options
  const seen = new Set([correctId]);
  const uniqueIncorrect = [];
  
  for (const inc of incorrectAnswers || []) {
    const id = getIdentifier(inc);
    if (!seen.has(id)) {
      seen.add(id);
      uniqueIncorrect.push(inc);
    }
  }
  
  // Shuffle the incorrect options among themselves
  const shuffledIncorrect = shuffleArray(uniqueIncorrect, rng);
  
  // Total choices needed
  const totalOptions = 1 + shuffledIncorrect.length;
  const clampedPosition = Math.max(0, Math.min(targetPosition, totalOptions - 1));
  
  // Build final array placing correctAnswer precisely at clampedPosition
  const result = [];
  let incorrectIndex = 0;
  
  for (let i = 0; i < totalOptions; i++) {
    if (i === clampedPosition) {
      result.push(correctAnswer);
    } else {
      result.push(shuffledIncorrect[incorrectIndex++]);
    }
  }
  
  return result;
}

/**
 * Transforms a list of questions for a game session by randomizing and balancing
 * the correct answer positions across the entire question set.
 * 
 * Works immutably without mutating the source objects.
 * 
 * @param {Array} questions - Array of question objects
 * @param {Function|string|number} [randomFnOrSeed=Math.random] - Optional custom random function or seed for multiplayer sync
 * @returns {Array} New array of question objects with balanced randomized option positions
 */
export function balanceAndRandomizeQuestionOptions(questions, randomFnOrSeed = Math.random) {
  if (!Array.isArray(questions) || questions.length === 0) return [];
  const rng = resolveRandomFn(randomFnOrSeed);
  
  // Group questions by their individual option count so each group is independently balanced
  const groupsByOptionCount = new Map();
  
  questions.forEach((q, originalIndex) => {
    const opts = q.options || q.choices || q.culpritChoices || q.questions?.[0]?.choices || [];
    const count = opts.length > 0 ? opts.length : 4;
    if (!groupsByOptionCount.has(count)) {
      groupsByOptionCount.set(count, []);
    }
    groupsByOptionCount.get(count).push({ question: q, originalIndex });
  });

  const balancedQuestionsByIndex = new Array(questions.length);

  for (const [optionCount, items] of groupsByOptionCount.entries()) {
    const balancedPositions = createBalancedAnswerPositions(items.length, optionCount, rng);
    
    items.forEach((item, itemIdx) => {
      const q = item.question;
      const targetPos = balancedPositions[itemIdx];
      const cloned = { ...q };

      // 1. Check if question has `culpritChoices` array
      if (Array.isArray(q.culpritChoices) && q.culpritChoices.length > 0) {
        const correctChoice = q.culpritChoices.find(c => c.id === q.correctAnswer || c.id === q.answer) || q.culpritChoices[0];
        const incorrectChoices = q.culpritChoices.filter(c => c !== correctChoice);
        cloned.culpritChoices = generateQuestionOptions(correctChoice, incorrectChoices, targetPos % q.culpritChoices.length, rng);
      }
      // 2. Check if question has `choices` array
      else if (Array.isArray(q.choices) && q.choices.length > 0) {
        const sampleChoice = q.choices[0];
        if (typeof sampleChoice === 'object' && sampleChoice !== null) {
          // Object choices like { id, label }
          const correctChoice = q.choices.find(c => c.id === q.correctAnswer || c.id === q.answer) || q.choices[0];
          const incorrectChoices = q.choices.filter(c => c !== correctChoice);
          cloned.choices = generateQuestionOptions(correctChoice, incorrectChoices, targetPos % q.choices.length, rng);
        } else {
          // String choices
          const correct = q.correctAnswer || q.answer;
          const incorrect = q.choices.filter(c => String(c).trim().toLowerCase() !== String(correct).trim().toLowerCase());
          cloned.choices = generateQuestionOptions(correct, incorrect, targetPos % q.choices.length, rng);
        }
      }
      // 3. Check if question has `options` array (strings)
      else if (Array.isArray(q.options) && q.options.length > 0) {
        const correct = q.correctAnswer || q.answer;
        const incorrect = q.options.filter(opt => String(opt).trim().toLowerCase() !== String(correct).trim().toLowerCase());
        cloned.options = generateQuestionOptions(correct, incorrect, targetPos % q.options.length, rng);
      }

      balancedQuestionsByIndex[item.originalIndex] = cloned;
    });
  }
  
  return balancedQuestionsByIndex;
}

/**
 * Validates the balance of correct answer positions across an array of randomized questions.
 * Ensures that for questions with K options, the difference between the most frequent
 * and least frequent position is at most 1 (or within expected tolerance).
 * 
 * @param {Array} questions - Array of prepared questions
 * @param {number} [optionCount=4] - Expected number of options (or detected dynamically)
 * @returns {{ isBalanced: boolean, distribution: Record<string, number>, maxDiff: number }}
 */
export function validateAnswerDistribution(questions, optionCount) {
  const letters = ["A", "B", "C", "D", "E", "F"];
  
  // Determine effective option count if not explicitly provided
  const sampleQ = questions[0];
  const sampleOpts = sampleQ ? (sampleQ.options || sampleQ.choices || sampleQ.culpritChoices || sampleQ.questions?.[0]?.choices || []) : [];
  const effectiveOptionCount = optionCount || (sampleOpts.length > 0 ? sampleOpts.length : 4);
  
  const counts = {};
  for (let i = 0; i < effectiveOptionCount; i++) {
    counts[letters[i] || `Opt${i}`] = 0;
  }
  
  questions.forEach(q => {
    const options = q.options || q.choices || q.culpritChoices || q.questions?.[0]?.choices || [];
    let correctIndex = -1;
    
    if (options.length > 0 && typeof options[0] === 'object' && options[0] !== null) {
      correctIndex = options.findIndex(opt => opt.id === q.correctAnswer || opt.id === q.answer);
    } else {
      correctIndex = options.findIndex(opt => String(opt).trim().toLowerCase() === String(q.correctAnswer || q.answer).trim().toLowerCase());
    }
    
    if (correctIndex >= 0 && correctIndex < effectiveOptionCount) {
      const letter = letters[correctIndex] || `Opt${correctIndex}`;
      counts[letter] = (counts[letter] || 0) + 1;
    }
  });
  
  const values = Object.values(counts);
  const max = Math.max(...values);
  const min = Math.min(...values);
  const maxDiff = max - min;
  
  return {
    isBalanced: maxDiff <= 1,
    distribution: counts,
    maxDiff
  };
}

export default {
  createBalancedAnswerPositions,
  generateQuestionOptions,
  balanceAndRandomizeQuestionOptions,
  validateAnswerDistribution
};
