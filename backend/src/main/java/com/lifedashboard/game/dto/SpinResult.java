package com.lifedashboard.game.dto;

/** reels = 3 symbol indexes (0–5); payout = coins won; balance = new wallet total. */
public record SpinResult(int[] reels, long bet, long payout, long balance) {
}
