package com.lifedashboard.game;

import com.lifedashboard.game.dto.Seth2Round;
import com.lifedashboard.game.dto.Seth2SpinRequest;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

/** Smoke test for the Seth II engine (pure resolvePurchase, no wallet/auth). */
class Seth2SlotServiceSmokeTest {

    private final Seth2SlotService svc = new Seth2SlotService(null, null);

    @Test
    void normalSpinsAreWellFormed() {
        long bet = 10;
        for (int i = 0; i < 2000; i++) {
            Seth2SlotService.Outcome o = svc.resolvePurchase(bet, Seth2SpinRequest.Buy.NONE);
            assertEquals(bet, o.cost());
            assertFalse(o.rounds().isEmpty());
            assertEquals("BASE", o.rounds().get(0).type());
            assertTrue(o.cappedWin() >= 0 && o.cappedWin() <= bet * 25000);
            for (Seth2Round r : o.rounds()) {
                assertFalse(r.tumbles().isEmpty());
                // last frame of every round has no wins (sequence terminated)
                assertTrue(r.tumbles().get(r.tumbles().size() - 1).winPositions().isEmpty());
                for (var t : r.tumbles()) {
                    assertEquals(30, t.grid().size());
                    for (var c : t.grid()) {
                        assertTrue(c.type() >= 0 && c.type() <= 10);
                        if (c.type() == 10) assertTrue(c.value() >= 2 && c.value() <= 500);
                    }
                }
            }
            // free spins only when the base round showed 3+ scatters
            if (o.freeSpins() > 0) assertTrue(o.rounds().size() > 1);
        }
    }

    @Test
    void buyTiersCostAndBehave() {
        long bet = 10;
        Seth2SlotService.Outcome free = svc.resolvePurchase(bet, Seth2SpinRequest.Buy.FREE);
        assertEquals(bet * 200, free.cost());
        assertEquals(10, countFree(free) >= 10 ? 10 : countFree(free)); // at least the base award
        assertTrue(free.freeSpins() >= 10);

        Seth2SlotService.Outcome awaken = svc.resolvePurchase(bet, Seth2SpinRequest.Buy.AWAKEN);
        assertEquals(bet * 500, awaken.cost());
        assertTrue(awaken.rounds().stream().allMatch(Seth2Round::awakened), "AWAKEN buy is always awakened");

        Seth2SlotService.Outcome immortal = svc.resolvePurchase(bet, Seth2SpinRequest.Buy.IMMORTAL);
        assertEquals(bet * 2000, immortal.cost());
        // guaranteed x500 orb somewhere on the first free spin's initial board
        boolean has500 = immortal.rounds().get(0).tumbles().get(0).grid().stream()
                .anyMatch(c -> c.type() == 10 && c.value() >= 500);
        assertTrue(has500, "IMMORTAL guarantees a x500 orb on the first spin");
    }

    @Test
    void roughRtpIsSane() {
        long bet = 10;
        long spent = 0, won = 0;
        for (int i = 0; i < 20000; i++) {
            Seth2SlotService.Outcome o = svc.resolvePurchase(bet, Seth2SpinRequest.Buy.NONE);
            spent += o.cost();
            won += o.cappedWin();
        }
        double rtp = (double) won / spent;
        // Very loose bounds — just catch a broken paytable (RTP 10x off etc.).
        assertTrue(rtp > 0.3 && rtp < 2.0, "base-game RTP ≈ " + rtp);
    }

    private long countFree(Seth2SlotService.Outcome o) {
        return o.rounds().stream().filter(r -> r.type().equals("FREE")).count();
    }
}
