package com.lifedashboard.game;

import com.lifedashboard.common.exception.ForbiddenException;
import com.lifedashboard.game.dto.FishVolleyRequest;
import com.lifedashboard.game.dto.FishVolleyResult;
import com.lifedashboard.security.CurrentUserService;
import com.lifedashboard.user.User;
import com.lifedashboard.user.UserService;
import com.lifedashboard.wallet.WalletService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.security.SecureRandom;
import java.util.ArrayList;
import java.util.List;

/**
 * "深海獵金" fish-hunter arcade (virtual coins, learning only).
 *
 * <p>Server-authoritative like the slots: the client animates fish/bullets, but
 * every kill is decided here. Bullets are batched into volleys (~0.6s of play);
 * each shot debits the bet, each reported hit gets an independent kill roll with
 * probability {@code RTP / payout}, so expected return per shot is RTP no matter
 * which fish the player aims at — bigger fish just mean higher variance.</p>
 */
@Service
@RequiredArgsConstructor
public class FishHunterService {

    /** Payout multiple (× bet) per species id — must match the frontend table. */
    static final int[] PAYOUTS = {
            2,    // 0  小丑魚
            3,    // 1  藍雀鯛
            4,    // 2  神仙魚
            5,    // 3  河豚
            6,    // 4  燈籠魚
            8,    // 5  水母
            12,   // 6  獅子魚
            15,   // 7  海龜
            20,   // 8  魔鬼魚
            25,   // 9  旗魚
            30,   // 10 龍蝦
            40,   // 11 黃金鯧
            60,   // 12 鯊魚
            120,  // 13 黃金鯊
            250,  // 14 深海龍王
    };

    private static final double RTP = 0.94;
    private static final int MAX_HITS = 60;

    private final SecureRandom random = new SecureRandom();
    private final CurrentUserService currentUserService;
    private final WalletService walletService;

    public FishVolleyResult volley(FishVolleyRequest req) {
        User user = currentUserService.getCurrentUser();
        if (!UserService.isPlayer(user)) {
            throw new ForbiddenException("Game access requires the player role");
        }
        if (req.hits().size() > MAX_HITS) {
            throw new IllegalArgumentException("Too many hits in one volley");
        }

        long cost = req.bet() * req.shots();
        long balance = walletService.balanceOf(user.getId());
        if (balance < cost) {
            throw new ForbiddenException("Insufficient coins");
        }

        List<Long> wins = new ArrayList<>(req.hits().size());
        long totalWin = 0;
        for (Integer type : req.hits()) {
            long win = 0;
            if (type != null && type >= 0 && type < PAYOUTS.length) {
                int payout = PAYOUTS[type];
                if (random.nextDouble() < RTP / payout) {
                    win = req.bet() * payout;
                    totalWin += win;
                }
            }
            wins.add(win);
        }

        long newBalance = walletService.applyDelta(user.getId(), totalWin - cost);
        return new FishVolleyResult(cost, totalWin, wins, newBalance);
    }
}
