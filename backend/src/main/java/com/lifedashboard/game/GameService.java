package com.lifedashboard.game;

import com.lifedashboard.common.exception.ForbiddenException;
import com.lifedashboard.game.dto.SpinResult;
import com.lifedashboard.security.CurrentUserService;
import com.lifedashboard.user.User;
import com.lifedashboard.user.UserService;
import com.lifedashboard.wallet.WalletService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.security.SecureRandom;

/**
 * A casino-style slot machine for learning purposes only — no real money.
 * The spin (RNG, bet deduction, payout) is computed entirely server-side so the
 * outcome and the wallet can't be tampered with from the client.
 */
@Service
@RequiredArgsConstructor
public class GameService {

    // Symbol weights (relative). Rarer symbols pay more. Index 0–5.
    private static final int[] WEIGHTS = {30, 25, 20, 13, 9, 3};
    // 3-of-a-kind multipliers by symbol.
    private static final int[] TRIPLE_MULTIPLIER = {3, 5, 8, 12, 25, 50};
    private static final int WEIGHT_TOTAL = 100; // sum of WEIGHTS

    private final SecureRandom random = new SecureRandom();
    private final CurrentUserService currentUserService;
    private final WalletService walletService;

    private User requirePlayer() {
        User u = currentUserService.getCurrentUser();
        if (!UserService.isPlayer(u)) {
            throw new ForbiddenException("Game access requires the player role");
        }
        return u;
    }

    private int pickSymbol() {
        int r = random.nextInt(WEIGHT_TOTAL);
        int acc = 0;
        for (int i = 0; i < WEIGHTS.length; i++) {
            acc += WEIGHTS[i];
            if (r < acc) return i;
        }
        return WEIGHTS.length - 1;
    }

    public SpinResult spin(long bet) {
        User user = requirePlayer();
        Long userId = user.getId();

        long balance = walletService.balanceOf(userId);
        if (balance < bet) {
            throw new ForbiddenException("Insufficient coins");
        }

        int[] reels = {pickSymbol(), pickSymbol(), pickSymbol()};

        long payout;
        if (reels[0] == reels[1] && reels[1] == reels[2]) {
            payout = bet * TRIPLE_MULTIPLIER[reels[0]];
        } else if (reels[0] == reels[1] || reels[1] == reels[2] || reels[0] == reels[2]) {
            payout = bet; // two of a kind returns the stake (net 0)
        } else {
            payout = 0;
        }

        long newBalance = walletService.applyDelta(userId, payout - bet);
        return new SpinResult(reels, bet, payout, newBalance);
    }
}
