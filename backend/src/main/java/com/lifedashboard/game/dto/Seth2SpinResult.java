package com.lifedashboard.game.dto;

import java.util.List;

/** The full replayable result of one Seth II purchase (base spin or bought feature). */
public record Seth2SpinResult(
        long bet,
        long cost,
        List<Seth2Round> rounds,
        int freeSpins,
        long totalPayout,
        long balance
) {
}
