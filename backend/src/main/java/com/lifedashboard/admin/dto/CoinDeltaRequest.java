package com.lifedashboard.admin.dto;

/** Signed amount to add (+) or deduct (-) from a user's coin balance. */
public record CoinDeltaRequest(long delta) {
}
