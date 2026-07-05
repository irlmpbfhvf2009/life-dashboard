package com.lifedashboard.game.dto;

import java.util.List;

/**
 * Server-resolved outcome of one volley. {@code wins} is aligned with the
 * request's {@code hits} list — 0 means the fish survived, &gt;0 is the payout
 * credited for that kill.
 */
public record FishVolleyResult(
        long cost,
        long totalWin,
        List<Long> wins,
        long balance
) {
}
