package com.lifedashboard.game.dto;

import java.util.List;

/**
 * One spin and its full tumble sequence. type = "BASE" or "FREE".
 * {@code multiplier} is the summed orb multiplier applied to this round
 * (1 = none). {@code pay} is the final coins for the round (base pay × multiplier).
 * {@code spinIndex}/{@code spinTotal} number a free spin within its session
 * (e.g. 3 / 15); both 0 for the base round.
 */
public record SethRound(
        String type,
        List<SethTumble> tumbles,
        int multiplier,
        long pay,
        int spinIndex,
        int spinTotal
) {
}
