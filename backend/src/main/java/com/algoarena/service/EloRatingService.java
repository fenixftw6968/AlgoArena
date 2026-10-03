package com.algoarena.service;

import org.springframework.stereotype.Service;

@Service
public class EloRatingService {

    public static final int RATING_STEP = 25;

    public static class EloResult {
        private final int newRatingA;
        private final int newRatingB;
        private final int deltaA;
        private final int deltaB;

        public EloResult(int newRatingA, int newRatingB, int deltaA, int deltaB) {
            this.newRatingA = newRatingA;
            this.newRatingB = newRatingB;
            this.deltaA = deltaA;
            this.deltaB = deltaB;
        }

        public int getNewRatingA() { return newRatingA; }
        public int getNewRatingB() { return newRatingB; }
        public int getDeltaA() { return deltaA; }
        public int getDeltaB() { return deltaB; }
    }

    /**
     * Calculates updated ratings:
     * - Win increases rating by 25 (+25)
     * - Loss decreases rating by 25 (-25), clamped at minimum 0
     * - Draw has 0 change
     *
     * @param ratingA Current rating of player A
     * @param ratingB Current rating of player B
     * @param actualScoreA 1.0 if A wins, 0.0 if B wins (A loses), 0.5 for draw
     * @return EloResult with updated ratings and deltas
     */
    public EloResult calculateNewRatings(int ratingA, int ratingB, double actualScoreA) {
        int deltaA;
        int deltaB;

        if (actualScoreA == 1.0) {
            // Player A wins, Player B loses
            deltaA = RATING_STEP;
            deltaB = -RATING_STEP;
        } else if (actualScoreA == 0.0) {
            // Player A loses, Player B wins
            deltaA = -RATING_STEP;
            deltaB = RATING_STEP;
        } else {
            // Draw
            deltaA = 0;
            deltaB = 0;
        }

        int newRatingA = Math.max(0, ratingA + deltaA);
        int newRatingB = Math.max(0, ratingB + deltaB);

        // Clamp delta if floored at 0
        deltaA = newRatingA - ratingA;
        deltaB = newRatingB - ratingB;

        return new EloResult(newRatingA, newRatingB, deltaA, deltaB);
    }
}
