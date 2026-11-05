package com.algoarena.util;

public class RankUtil {

    public enum RankTier {
        IRON("Iron", 0, 100, "#94A3B8", "⚙️"),
        BRONZE("Bronze", 101, 200, "#CD7F32", "🥉"),
        SILVER("Silver", 201, 300, "#E2E8F0", "🥈"),
        GOLD("Gold", 301, 400, "#FBBF24", "🥇"),
        PLATINUM("Platinum", 401, 500, "#38BDF8", "💎"),
        DIAMOND("Diamond", 501, 600, "#818CF8", "💠"),
        MASTER("Master", 601, 700, "#C084FC", "⚡"),
        GRANDMASTER("Grandmaster", 701, Integer.MAX_VALUE, "#C5F467", "👑");

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
        return RankTier.IRON;
    }

    public static String getRankName(int rating) {
        return getRankFromRating(rating).getName();
    }
}
