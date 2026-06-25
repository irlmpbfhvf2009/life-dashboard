package com.lifedashboard.game.dto;

import java.util.List;

/**
 * The full server-resolved outcome of one Seth slot purchase: the base round
 * plus any free-spin rounds it triggered. {@code cost} = coins actually staked
 * (bet, ante stake, or bonus-buy price). {@code freeSpins} = number of free
 * spins awarded (0 if none). {@code totalPayout} = coins returned to the wallet;
 * {@code balance} = the new wallet total after stake & payout.
 */
public record SethSpinResult(
        long bet,
        long cost,
        List<SethRound> rounds,
        int freeSpins,
        long totalPayout,
        long balance
) {
}
