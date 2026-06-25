package com.lifedashboard.game;

import com.lifedashboard.game.dto.SethRound;
import com.lifedashboard.game.dto.SethTumble;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Exercises the pure Seth tumble engine (no wallet / auth) over many spins to
 * confirm the mechanics are sane and the three staking modes (base / ante /
 * bonus buy) all land in a reasonable RTP band, with the free-spin feature
 * worth roughly its bonus-buy price.
 */
class SethSlotServiceTest {

    private final SethSlotService engine = new SethSlotService(null, null);
    private static final long BET = 20;
    private static final int SPINS = 40_000; // enough for a stable guard given the wide RTP bands

    private record Stats(double rtp, double hitRate, double freeTrig, double freeAvgX,
                         int maxMult, double maxWinX, long cappedCount) {
    }

    private Stats simulate(boolean ante, boolean buyBonus) {
        long totalCost = 0, totalWin = 0, hits = 0, freeSessions = 0, freeSessionWin = 0;
        long capped = 0;
        int maxMult = 1;
        double maxWinX = 0;

        for (int n = 0; n < SPINS; n++) {
            SethSlotService.Outcome o = engine.resolvePurchase(BET, ante, buyBonus);
            totalCost += o.cost();
            totalWin += o.cappedWin();
            if (o.cappedWin() > 0) hits++;
            if (o.cappedWin() >= BET * 5000) capped++;
            maxWinX = Math.max(maxWinX, (double) o.cappedWin() / BET);
            if (o.freeSpins() > 0) {
                freeSessions++;
                freeSessionWin += o.cappedWin();
            }
            for (SethRound r : o.rounds()) maxMult = Math.max(maxMult, r.multiplier());

            // Structural invariants on every purchase.
            assertFalse(o.rounds().isEmpty(), "a purchase always has at least one round");
            assertTrue(o.cappedWin() >= 0 && o.cappedWin() <= BET * 5000, "win within [0, cap]");
            assertTrue(o.cost() > 0, "a purchase always costs something");
            for (SethRound round : o.rounds()) {
                assertFalse(round.tumbles().isEmpty(), "a round always has at least one frame");
                assertTrue(round.multiplier() >= 1, "applied multiplier is at least 1");
                for (SethTumble t : round.tumbles()) {
                    assertEquals(30, t.grid().size(), "board is always 6x5 = 30 cells");
                }
                assertTrue(round.tumbles().get(round.tumbles().size() - 1).winPositions().isEmpty(),
                        "the last frame is the settled board");
            }
        }
        return new Stats(
                (double) totalWin / totalCost,
                (double) hits / SPINS,
                (double) freeSessions / SPINS,
                freeSessions == 0 ? 0 : (double) freeSessionWin / freeSessions / BET,
                maxMult, maxWinX, capped);
    }

    @Test
    void allThreeModesAreSane() {
        Stats base = simulate(false, false);
        Stats ante = simulate(true, false);
        Stats buy = simulate(false, true);

        System.out.printf("BASE: RTP=%.4f hit=%.4f freeTrig=%.5f freeAvg=%.1fx maxMult=%d maxWin=x%.0f capped=%d%n",
                base.rtp, base.hitRate, base.freeTrig, base.freeAvgX, base.maxMult, base.maxWinX, base.cappedCount);
        System.out.printf("ANTE: RTP=%.4f freeTrig=%.5f freeAvg=%.1fx%n", ante.rtp, ante.freeTrig, ante.freeAvgX);
        System.out.printf("BUY : RTP=%.4f freeAvg=%.1fx maxWin=x%.0f%n", buy.rtp, buy.freeAvgX, buy.maxWinX);

        assertTrue(base.hitRate > 0 && base.freeTrig > 0, "base game wins and triggers free spins");
        // Bands are wide on purpose: at this sample size the free-spin-heavy modes
        // swing several points run-to-run. They still catch gross regressions (a
        // mis-tuned paytable or runaway multiplier sends RTP far outside these).
        assertTrue(base.rtp > 0.85 && base.rtp < 1.08, "base RTP near a real slot, was " + base.rtp);
        assertTrue(ante.rtp > 0.85 && ante.rtp < 1.12, "ante RTP near a real slot, was " + ante.rtp);
        assertTrue(buy.rtp > 0.88 && buy.rtp < 1.06, "bonus-buy RTP near a real slot, was " + buy.rtp);
    }
}
