// Rank definition and utilities in Dark Theme
export const COMPETITIVE_RANKS = [
  { name: "Iron",        minRating: 0,    maxRating: 100,  badge: "⚙️", color: "#94A3B8", bg: "rgba(148, 163, 184, 0.12)", border: "rgba(148, 163, 184, 0.25)", desc: "Foundational tier" },
  { name: "Bronze",      minRating: 101,  maxRating: 200,  badge: "🥉", color: "#CD7F32", bg: "rgba(205, 127, 50, 0.12)",  border: "rgba(205, 127, 50, 0.25)",  desc: "Starting competitive baseline" },
  { name: "Silver",      minRating: 201,  maxRating: 300,  badge: "🥈", color: "#E2E8F0", bg: "rgba(226, 232, 240, 0.12)", border: "rgba(226, 232, 240, 0.25)", desc: "Rising competitor" },
  { name: "Gold",        minRating: 301,  maxRating: 400,  badge: "🥇", color: "#FBBF24", bg: "rgba(251, 191, 36, 0.12)",  border: "rgba(251, 191, 36, 0.25)",  desc: "Proven problem solver" },
  { name: "Platinum",    minRating: 401,  maxRating: 500,  badge: "💎", color: "#38BDF8", bg: "rgba(56, 189, 248, 0.12)",  border: "rgba(56, 189, 248, 0.25)",  desc: "Advanced logic mastery" },
  { name: "Diamond",     minRating: 501,  maxRating: 600,  badge: "💠", color: "#818CF8", bg: "rgba(129, 140, 248, 0.12)", border: "rgba(129, 140, 248, 0.25)", desc: "Elite algorithmic tactician" },
  { name: "Master",      minRating: 601,  maxRating: 700,  badge: "⚡", color: "#C084FC", bg: "rgba(192, 132, 252, 0.12)", border: "rgba(192, 132, 252, 0.25)", desc: "Master of optimization" },
  { name: "Grandmaster", minRating: 701,  maxRating: 9999, badge: "👑", color: "#C5F467", bg: "rgba(197, 244, 103, 0.12)", border: "rgba(197, 244, 103, 0.32)", desc: "Apex algorithm engineer" },
];

export const getRankFromRating = (rating) => {
  const r = Math.max(0, Number(rating) || 0);
  return COMPETITIVE_RANKS.find(rank => r >= rank.minRating && r <= rank.maxRating) || COMPETITIVE_RANKS[0];
};

export const getNextRank = (rating) => {
  const current = getRankFromRating(rating);
  const idx = COMPETITIVE_RANKS.findIndex(r => r.name === current.name);
  if (idx < COMPETITIVE_RANKS.length - 1) {
    return COMPETITIVE_RANKS[idx + 1];
  }
  return null;
};

export const getRankProgress = (rating) => {
  const current = getRankFromRating(rating);
  const next = getNextRank(rating);
  if (!next) return 100;
  const range = next.minRating - current.minRating;
  const currentInRange = (rating || 0) - current.minRating;
  return Math.min(100, Math.max(0, Math.round((currentInRange / range) * 100)));
};
