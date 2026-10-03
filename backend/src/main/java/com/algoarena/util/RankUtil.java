package com.algoarena.util;

public class RankUtil {

    public enum RankTier {
        ROOKIE("Rookie", 0, 199, "#64748B", "🌱"),
        SCOUT("Scout", 200, 399, "#0284C7", "🧭"),
        KNIGHT("Knight", 400, 599, "#2563EB", "🛡️"),
        GUARDIAN("Guardian", 600, 799, "#7C3AED", "⚔️"),
        CHAMPION("Champion", 800, 1049, "#D97706", "🌟"),
        ELITE("Elite", 1050, 1349, "#E11D48", "⚡"),
        LEGEND("Legend", 1350, 1699, "#9333EA", "🔮"),
        MYTHIC("Mythic", 1700, Integer.MAX_VALUE, "#4F46E5", "👑");

        private final String name;
        private final int minRating;
        private final int maxRating;
        private final String color;
        private final String icon;

        RankTier(String name, int minRating, int maxRating, String color, String icon) {
            this.name = name;
            this.minRating = minRating;
            this.maxRating = maxRating;
            this.color = color;
            this.icon = icon;
        }

        public String getName() {
            return name;
        }

        public int getMinRating() {
            return minRating;
        }

        public int getMaxRating() {
            return maxRating;
        }

        public String getColor() {
            return color;
        }

        public String getIcon() {
            return icon;
        }
    }

    public static RankTier getRankFromRating(int rating) {
        int r = Math.max(0, rating);
        for (RankTier tier : RankTier.values()) {
            if (r >= tier.getMinRating() && r <= tier.getMaxRating()) {
                return tier;
            }
        }
        return RankTier.ROOKIE;
    }

    public static String getRankName(int rating) {
        return getRankFromRating(rating).getName();
    }
}
