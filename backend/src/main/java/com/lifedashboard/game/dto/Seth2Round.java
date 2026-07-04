package com.lifedashboard.game.dto;

import java.util.List;

/**
 * One resolved Seth II spin: the tumble frames plus the multiplier applied to
 * the whole sequence. {@code awakened} marks free spins played in 覺醒之力 mode
 * so the client can tint the board.
 */
public record Seth2Round(
        String type, // BASE | FREE
        List<SethTumble> tumbles,
        int multiplier,
        long pay,
        int spinIndex,
        int spinTotal,
        boolean awakened
) {
}
