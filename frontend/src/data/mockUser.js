// Mock user data for Phase 1 (pre-backend)
export const mockUser = {
  id: 1,
  username: "ShadowThinker",
  email: "shadow@mindmaze.io",
  xp: 720,
  level: 7,
  rank: "Detective",
  coins: 340,
  currentStreak: 5,
  longestStreak: 12,
  gamesCompleted: 48,
  mysteriesSolved: 3,
  createdAt: "2024-01-15T10:00:00Z",
  recentActivity: [
    { id: 1, action: "Solved Number Detective", xpGained: 25, timestamp: new Date().toISOString(), icon: "🔢" },
    { id: 2, action: "Completed Pattern Detective", xpGained: 50, timestamp: new Date(Date.now() - 86400000).toISOString(), icon: "🧩" },
    { id: 3, action: "Mystery Case: Missing Diamond", xpGained: 150, timestamp: new Date(Date.now() - 172800000).toISOString(), icon: "🔍" },
    { id: 4, action: "Daily Challenge Completed", xpGained: 100, timestamp: new Date(Date.now() - 259200000).toISOString(), icon: "🔥" },
    { id: 5, action: "Who is Lying? - Hard Mode", xpGained: 50, timestamp: new Date(Date.now() - 345600000).toISOString(), icon: "🎭" },
  ]
};

export const XP_PER_LEVEL = [
  0, 100, 250, 450, 700, 1000, 1350, 1750, 2200, 2700,
  3250, 3850, 4500, 5200, 5950, 6750, 7600, 8500, 9450, 10450,
  11500, 12600, 13750, 14950, 16200, 17500
];

export const RANKS = [
  { minLevel: 1,  maxLevel: 4,  name: "Beginner",   color: "#a1a1b5", icon: "🌱" },
  { minLevel: 5,  maxLevel: 8,  name: "Scholar",    color: "#06b6d4", icon: "⚡" },
  { minLevel: 9,  maxLevel: 12, name: "Solver",     color: "#10b981", icon: "🧩" },
  { minLevel: 13, maxLevel: 16, name: "Detective",  color: "#8b5cf6", icon: "🕵️" },
  { minLevel: 17, maxLevel: 20, name: "Strategist", color: "#f59e0b", icon: "⚡" },
  { minLevel: 21, maxLevel: 25, name: "Mastermind", color: "#f43f5e", icon: "🧠" },
];

export const getRankForLevel = (level) => {
  return RANKS.find(r => level >= r.minLevel && level <= r.maxLevel) || RANKS[0];
};

export const getLevelFromXP = (xp) => {
  let level = 1;
  for (let i = 0; i < XP_PER_LEVEL.length; i++) {
    if (xp >= XP_PER_LEVEL[i]) level = i + 1;
    else break;
  }
  return Math.min(level, 25);
};

export const getXPForNextLevel = (level) => XP_PER_LEVEL[level] || XP_PER_LEVEL[XP_PER_LEVEL.length - 1];
export const getXPForCurrentLevel = (level) => XP_PER_LEVEL[level - 1] || 0;
