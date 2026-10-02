// Rank definition and utilities in Dark Theme
export const COMPETITIVE_RANKS = [
  { name: "Rookie",   minRating: 0,    maxRating: 199,  badge: "🌱", color: "#94A3B8", bg: "rgba(148, 163, 184, 0.12)", border: "rgba(148, 163, 184, 0.25)", desc: "Starting tier" },
  { name: "Scout",    minRating: 200,  maxRating: 399,  badge: "🧭", color: "#38BDF8", bg: "rgba(56, 189, 248, 0.12)", border: "rgba(56, 189, 248, 0.25)", desc: "Sharpening reflexes" },
  { name: "Knight",   minRating: 400,  maxRating: 599,  badge: "🛡️", color: "#60A5FA", bg: "rgba(96, 165, 250, 0.12)", border: "rgba(96, 165, 250, 0.25)", desc: "" },
  { name: "Guardian", minRating: 600,  maxRating: 799,  badge: "⚔️", color: "#C084FC", bg: "rgba(192, 132, 252, 0.12)", border: "rgba(192, 132, 252, 0.25)", desc: "Proven defender" },
  { name: "Champion", minRating: 800,  maxRating: 1049, badge: "🌟", color: "#FBBF24", bg: "rgba(251, 191, 36, 0.12)", border: "rgba(251, 191, 36, 0.25)", desc: "Grand competitor" },
  { name: "Elite",    minRating: 1050, maxRating: 1349, badge: "⚡", color: "#FB7185", bg: "rgba(251, 113, 133, 0.12)", border: "rgba(251, 113, 133, 0.25)", desc: "Master of speed" },
  { name: "Legend",   minRating: 1350, maxRating: 1699, badge: "🔮", color: "#E879F9", bg: "rgba(232, 121, 249, 0.12)", border: "rgba(232, 121, 249, 0.25)", desc: "Grandmaster mind" },
  { name: "Mythic",   minRating: 1700, maxRating: 9999, badge: "👑", color: "#4ADE80", bg: "rgba(74, 222, 128, 0.12)", border: "rgba(74, 222, 128, 0.25)", desc: "Peak intellect" },
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
