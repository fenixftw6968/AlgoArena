/**
 * MindForge Centralized Game Registry
 * Single source of truth for all active games, metadata, categories, and engine types.
 */

export const GAME_TYPES = {
  MCQ: 'mcq',
  QUESTION: 'question',
  MEMORY: 'memory',
  LOGIC: 'logic',
};

export const GAME_REGISTRY = {
  'dsa-master-quiz': {
    id: 1,
    slug: 'dsa-master-quiz',
    title: 'DSA Master Quiz',
    description: 'Test your coding knowledge, DSA concepts, code output skills, and complexity understanding.',
    category: 'Programming / DSA',
    icon: '🧠',
    difficulty: 'HARD',
    type: GAME_TYPES.MCQ,
    requiresDailyQuestions: true,
    xpReward: { easy: 15, medium: 30, hard: 60 },
    totalPlayers: 24500,
    completionRate: 64,
    isUnlocked: true,
    isNew: true,
    isFeatured: true,
    tags: ['dsa', 'c++', 'algorithms', 'trees', 'dp', 'complexity'],
    estimatedTime: '3-5 min',
  },
  'logic-puzzle': {
    id: 2,
    slug: 'logic-puzzle',
    title: 'Logic Puzzle',
    description: 'Solve patterns, sequences, deduction problems, and logical puzzles.',
    category: 'Reasoning',
    icon: '🧩',
    difficulty: 'MEDIUM',
    type: GAME_TYPES.MCQ,
    requiresDailyQuestions: true,
    xpReward: { easy: 15, medium: 25, hard: 50 },
    totalPlayers: 19800,
    completionRate: 72,
    isUnlocked: true,
    isNew: true,
    isFeatured: true,
    tags: ['logic', 'sequences', 'deduction', 'analogies', 'reasoning'],
    estimatedTime: '3-4 min',
  },
  'number-detective': {
    id: 3,
    slug: 'number-detective',
    title: 'Number Detective',
    description: 'Crack the code hidden in number sequences. Find the pattern and discover the missing number.',
    category: 'Reasoning',
    icon: '🔢',
    difficulty: 'MEDIUM',
    type: GAME_TYPES.QUESTION,
    requiresDailyQuestions: true,
    xpReward: { easy: 10, medium: 25, hard: 50 },
    totalPlayers: 12450,
    completionRate: 68,
    isUnlocked: true,
    isNew: false,
    isFeatured: false,
    tags: ['numbers', 'sequences', 'logic', 'math'],
    estimatedTime: '3-5 min',
  },
  'code-breaker': {
    id: 4,
    slug: 'code-breaker',
    title: 'Code Breaker',
    description: 'Use logical clues to deduce the secret code. Test your deductive reasoning and elimination skills.',
    category: 'Reasoning',
    icon: '🔐',
    difficulty: 'MEDIUM',
    type: GAME_TYPES.LOGIC,
    requiresDailyQuestions: true,
    xpReward: { easy: 15, medium: 30, hard: 60 },
    totalPlayers: 9420,
    completionRate: 62,
    isUnlocked: true,
    isNew: false,
    isFeatured: false,
    tags: ['logic', 'deduction', 'code', 'mastermind'],
    estimatedTime: '3-5 min',
  },
};

export const ACTIVE_GAME_SLUGS = Object.keys(GAME_REGISTRY);

export const getAllGamesList = () => Object.values(GAME_REGISTRY);

export const getGameConfig = (slug) => GAME_REGISTRY[slug] || null;

export const isDailyQuestionGame = (slug) => {
  const game = GAME_REGISTRY[slug];
  return game ? !!game.requiresDailyQuestions : false;
};

export default GAME_REGISTRY;
