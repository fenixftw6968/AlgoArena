package com.mindmaze.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

public class EloRatingServiceTest {

    private EloRatingService eloRatingService;

    @BeforeEach
    void setUp() {
        eloRatingService = new EloRatingService();
    }

    @Test
    void testEqualRatingWin() {
        // Win awards +25 points, loss -25 points
        EloRatingService.EloResult result = eloRatingService.calculateNewRatings(500, 500, 1.0);
        assertEquals(525, result.getNewRatingA());
        assertEquals(475, result.getNewRatingB());
        assertEquals(25, result.getDeltaA());
        assertEquals(-25, result.getDeltaB());
    }

    @Test
    void testHigherBeatingLower() {
        // Regardless of rating gap: winner gets +25, loser gets -25
        EloRatingService.EloResult result = eloRatingService.calculateNewRatings(800, 400, 1.0);
        assertEquals(825, result.getNewRatingA());
        assertEquals(375, result.getNewRatingB());
        assertEquals(25, result.getDeltaA());
        assertEquals(-25, result.getDeltaB());
    }

    @Test
    void testLowerBeatingHigher() {
        // Lower rated player beating higher: still +25 and -25
        EloRatingService.EloResult result = eloRatingService.calculateNewRatings(400, 800, 1.0);
        assertEquals(425, result.getNewRatingA());
        assertEquals(775, result.getNewRatingB());
        assertEquals(25, result.getDeltaA());
        assertEquals(-25, result.getDeltaB());
    }

    @Test
    void testDraw() {
        // Draw: 0 points change
        EloRatingService.EloResult result = eloRatingService.calculateNewRatings(500, 600, 0.5);
        assertEquals(500, result.getNewRatingA());
        assertEquals(600, result.getNewRatingB());
        assertEquals(0, result.getDeltaA());
        assertEquals(0, result.getDeltaB());
    }

    @Test
    void testFloorAtZero() {
        // Ensure rating does not drop below 0
        EloRatingService.EloResult result = eloRatingService.calculateNewRatings(10, 500, 0.0);
        assertEquals(0, result.getNewRatingA());
        assertEquals(-10, result.getDeltaA());
        assertEquals(525, result.getNewRatingB());
        assertEquals(25, result.getDeltaB());
    }
}
