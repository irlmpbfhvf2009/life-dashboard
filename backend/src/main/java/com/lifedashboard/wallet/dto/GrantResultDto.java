package com.lifedashboard.wallet.dto;

/** Result of a coin grant: how much was just granted, and the new balance. */
public record GrantResultDto(long granted, long balance) {
}
