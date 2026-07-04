package com.lifedashboard.game;

import com.lifedashboard.common.exception.ForbiddenException;
import com.lifedashboard.game.dto.Seth2Round;
import com.lifedashboard.game.dto.Seth2SpinRequest;
import com.lifedashboard.game.dto.Seth2SpinResult;
import com.lifedashboard.game.dto.SethCell;
import com.lifedashboard.game.dto.SethTumble;
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
 * "戰神賽特II・覺醒之力" — the sequel tumble slot (virtual coins, learning only).
 * Same server-authoritative design as {@link SethSlotService}: the whole cascade
 * sequence is resolved here and returned as replayable frames.
 *
 * <p>Differences from the first game: 9 pay symbols; 3 scatters trigger 10 free
 * spins; free spins carry a persistent multiplier fed by green-scarab orbs; the
 * session can <b>awaken (覺醒之力)</b> — either by triggering with 4+ scatters,
 * spontaneously during free spins, or by purchase — which raises orb frequency
 * and upgrades orb values. Three feature buys: FREE (200x, chance to awaken),
 * AWAKEN (500x, guaranteed awakened), IMMORTAL (2000x, awakened + a guaranteed
 * x500 orb on the first free spin + orbs may split into a neighbouring cell).</p>
 */
@Service
@RequiredArgsConstructor
public class Seth2SlotService {

    private static final int COLS = 6;
    private static final int ROWS = 5;
    private static final int CELLS = COLS * ROWS; // 30

    /** Cell types: 0–8 pay symbols (low→high), 9 = scatter, 10 = multiplier orb. */
    static final int SCATTER = 9;
    static final int ORB = 10;

    /** 9 pay symbols, low → high. Relative drop weights (rarer = pays more). */
    private static final int[] SYMBOL_WEIGHTS = {24, 22, 19, 16, 13, 9, 7, 5, 3};
    /** Pay × total bet, indexed [symbol][tier]; tier 0 = 8–9 of a kind, 1 = 10–11, 2 = 12+. */
    private static final double[][] PAYTABLE = {
            {0.06, 0.14, 0.40},  // 0 blue diamond
            {0.08, 0.20, 0.60},  // 1 green diamond
            {0.12, 0.30, 0.90},  // 2 purple gem
            {0.18, 0.44, 1.4},   // 3 amber gem
            {0.30, 0.60, 2.2},   // 4 red gem
            {0.45, 0.90, 3.5},   // 5 bow
            {0.70, 1.6, 6.0},    // 6 khopesh
            {1.2, 3.0, 10.0},    // 7 cobra
            {2.0, 5.0, 15.0},    // 8 eye of Horus (top symbol)
    };

    private static final int[] ORB_VALUES = {2, 3, 4, 5, 6, 8, 10, 15, 20, 25, 50, 100, 500};
    /** Orb value weights: normal vs awakened (awakened shifts the table upward). */
    private static final int[] ORB_WEIGHTS = {320, 240, 150, 90, 55, 35, 20, 10, 6, 4, 2, 1, 1};
    private static final int[] ORB_WEIGHTS_AWAKENED = {0, 60, 110, 130, 130, 110, 85, 55, 35, 22, 10, 4, 2};

    // Per-cell chance of a special symbol when a new cell is generated.
    private static final double ORB_CHANCE_BASE = 0.012;
    private static final double ORB_CHANCE_FREE = 0.040;
    private static final double ORB_CHANCE_AWAKENED = 0.065;
    private static final double SCATTER_CHANCE = 0.0135; // 3+ anywhere triggers

    private static final int FREE_SPINS_AWARD = 10;    // 3+ scatters (or any buy)
    private static final int FREE_SPINS_RETRIGGER = 5; // 3+ scatters during free spins
    private static final int FREE_SPINS_CAP = 40;
    private static final int AWAKEN_TRIGGER_SCATTERS = 4;    // 4+ scatters = awakened session
    private static final double AWAKEN_CHANCE_PER_SPIN = 0.06; // spontaneous awakening
    private static final double BUY_FREE_AWAKEN_CHANCE = 0.25; // FREE buy: chance to start awakened
    private static final int FREE_MULT_CAP = 1000;
    private static final int FREE_MULT_CAP_IMMORTAL = 2500;
    private static final long MAX_PAYOUT_MULTIPLE = 25000; // cap total win at bet × this

    private static final double SPLIT_CHANCE = 0.25; // immortal: an orb splits into a neighbour

    private static final long BUY_FREE_COST = 200;
    private static final long BUY_AWAKEN_COST = 500;
    private static final long BUY_IMMORTAL_COST = 2000;

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

    public Seth2SpinResult spin(long bet, Seth2SpinRequest.Buy buy) {
        User user = requirePlayer();
        Long userId = user.getId();

        Outcome outcome = resolvePurchase(bet, buy);

        long balance = walletService.balanceOf(userId);
        if (balance < outcome.cost()) {
            throw new ForbiddenException("Insufficient coins");
        }

        long newBalance = walletService.applyDelta(userId, outcome.cappedWin() - outcome.cost());
        return new Seth2SpinResult(bet, outcome.cost(), outcome.rounds(), outcome.freeSpins(),
                outcome.cappedWin(), newBalance);
    }

    record Outcome(List<Seth2Round> rounds, int freeSpins, long cappedWin, long cost) {
    }

    /** Pure engine: resolve one purchase with no wallet/auth side effects (testable). */
    Outcome resolvePurchase(long bet, Seth2SpinRequest.Buy buy) {
        long cost = switch (buy) {
            case NONE -> bet;
            case FREE -> bet * BUY_FREE_COST;
            case AWAKEN -> bet * BUY_AWAKEN_COST;
            case IMMORTAL -> bet * BUY_IMMORTAL_COST;
        };
        boolean immortal = buy == Seth2SpinRequest.Buy.IMMORTAL;

        List<Seth2Round> rounds = new ArrayList<>();
        long totalWin = 0;
        boolean enterFreeSpins;
        boolean awakened;

        switch (buy) {
            case NONE -> {
                RoundResult base = resolveRound(bet, false, false, false, 1, 0, 0);
                rounds.add(base.round);
                totalWin += base.round.pay();
                enterFreeSpins = base.scatterCount >= 3;
                awakened = base.scatterCount >= AWAKEN_TRIGGER_SCATTERS;
            }
            case FREE -> {
                enterFreeSpins = true;
                awakened = random.nextDouble() < BUY_FREE_AWAKEN_CHANCE;
            }
            default -> { // AWAKEN / IMMORTAL
                enterFreeSpins = true;
                awakened = true;
            }
        }

        int freeSpinsAwarded = 0;
        if (enterFreeSpins) {
            freeSpinsAwarded = FREE_SPINS_AWARD;
            int remaining = FREE_SPINS_AWARD;
            int played = 0;
            int persistentMult = 0; // carries across the whole session
            int multCap = immortal ? FREE_MULT_CAP_IMMORTAL : FREE_MULT_CAP;
            while (remaining > 0) {
                remaining--;
                played++;
                if (!awakened && random.nextDouble() < AWAKEN_CHANCE_PER_SPIN) {
                    awakened = true; // 覺醒之力 kicks in mid-session
                }
                boolean inject500 = immortal && played == 1; // 必定掉落 ×500
                RoundResult fs = resolveRound(bet, true, awakened, immortal, persistentMult,
                        played, Math.max(played + remaining, FREE_SPINS_AWARD), inject500, multCap);
                rounds.add(fs.round);
                totalWin += fs.round.pay();
                persistentMult = fs.persistentMult;
                if (fs.scatterCount >= 3 && freeSpinsAwarded < FREE_SPINS_CAP) {
                    int add = Math.min(FREE_SPINS_RETRIGGER, FREE_SPINS_CAP - freeSpinsAwarded);
                    remaining += add;
                    freeSpinsAwarded += add;
                }
            }
        }

        long cappedWin = Math.min(totalWin, bet * MAX_PAYOUT_MULTIPLE);
        return new Outcome(rounds, freeSpinsAwarded, cappedWin, cost);
    }

    private record RoundResult(Seth2Round round, int scatterCount, int persistentMult) {
    }

    private RoundResult resolveRound(long bet, boolean freeSpin, boolean awakened, boolean immortal,
                                     int incomingMult, int spinIndex, int spinTotal) {
        return resolveRound(bet, freeSpin, awakened, immortal, incomingMult, spinIndex, spinTotal,
                false, FREE_MULT_CAP);
    }

    /**
     * Resolve one spin's full tumble sequence.
     *
     * @param incomingMult the running session multiplier carried in (free spins)
     * @param inject500    force one ×500 orb onto the initial board (immortal, first spin)
     */
    private RoundResult resolveRound(long bet, boolean freeSpin, boolean awakened, boolean immortal,
                                     int incomingMult, int spinIndex, int spinTotal,
                                     boolean inject500, int multCap) {
        int[] type = new int[CELLS];
        int[] val = new int[CELLS];
        double orbChance = !freeSpin ? ORB_CHANCE_BASE
                : awakened ? ORB_CHANCE_AWAKENED
                : ORB_CHANCE_FREE;
        for (int i = 0; i < CELLS; i++) fillCell(type, val, i, orbChance, awakened);
        if (inject500) {
            int at = random.nextInt(CELLS);
            type[at] = ORB;
            val[at] = 500;
        }
        if (immortal) splitOrbs(type, val);

        List<SethTumble> tumbles = new ArrayList<>();
        long seqPay = 0;

        while (true) {
            int[] counts = new int[PAYTABLE.length];
            for (int i = 0; i < CELLS; i++) {
                if (type[i] >= 0 && type[i] < PAYTABLE.length) counts[type[i]]++;
            }

            List<Integer> winPositions = new ArrayList<>();
            long framePay = 0;
            for (int s = 0; s < PAYTABLE.length; s++) {
                if (counts[s] >= 8) {
                    int tier = counts[s] >= 12 ? 2 : counts[s] >= 10 ? 1 : 0;
                    framePay += Math.round(PAYTABLE[s][tier] * bet);
                    for (int i = 0; i < CELLS; i++) {
                        if (type[i] == s) winPositions.add(i);
                    }
                }
            }

            tumbles.add(new SethTumble(snapshot(type, val), List.copyOf(winPositions), framePay));
            if (winPositions.isEmpty()) break;

            seqPay += framePay;
            for (int i : winPositions) type[i] = -1;
            tumbleDown(type, val, orbChance, awakened);
        }

        // Specials surviving on the final board.
        int orbSum = 0;
        int scatterCount = 0;
        for (int i = 0; i < CELLS; i++) {
            if (type[i] == ORB) orbSum += val[i];
            else if (type[i] == SCATTER) scatterCount++;
        }

        if (seqPay > 0 && freeSpin) {
            // Free spins: orbs feed the persistent multiplier, which then applies.
            int persistent = Math.min(incomingMult + orbSum, multCap);
            int applied = Math.max(persistent, 1);
            Seth2Round round = new Seth2Round("FREE", tumbles, applied, seqPay * applied,
                    spinIndex, spinTotal, awakened);
            return new RoundResult(round, scatterCount, persistent);
        }

        long roundPay = 0;
        int applied = 1;
        if (seqPay > 0) {
            // Base game: this sequence's orbs apply to this sequence only.
            applied = orbSum > 0 ? orbSum : 1;
            roundPay = seqPay * applied;
        }
        Seth2Round round = new Seth2Round(freeSpin ? "FREE" : "BASE", tumbles, applied, roundPay,
                spinIndex, spinTotal, awakened);
        return new RoundResult(round, scatterCount, incomingMult);
    }

    // ----- board helpers -----

    private void fillCell(int[] type, int[] val, int i, double orbChance, boolean awakened) {
        double r = random.nextDouble();
        if (r < orbChance) {
            type[i] = ORB;
            val[i] = pickOrbValue(awakened);
        } else if (r < orbChance + SCATTER_CHANCE) {
            type[i] = SCATTER;
            val[i] = 0;
        } else {
            type[i] = pickSymbol();
            val[i] = 0;
        }
    }

    /** Immortal awakening: each orb may split, copying half its value into a neighbour. */
    private void splitOrbs(int[] type, int[] val) {
        for (int i = 0; i < CELLS; i++) {
            if (type[i] != ORB || random.nextDouble() >= SPLIT_CHANCE) continue;
            int row = i / COLS, col = i % COLS;
            int[][] dirs = {{0, 1}, {0, -1}, {1, 0}, {-1, 0}};
            int[] d = dirs[random.nextInt(dirs.length)];
            int nr = row + d[0], nc = col + d[1];
            if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS) continue;
            int n = nr * COLS + nc;
            if (type[n] == ORB || type[n] == SCATTER) continue;
            type[n] = ORB;
            val[n] = Math.max(2, val[i] / 2);
        }
    }

    private void tumbleDown(int[] type, int[] val, double orbChance, boolean awakened) {
        for (int c = 0; c < COLS; c++) {
            int[] keepType = new int[ROWS];
            int[] keepVal = new int[ROWS];
            int n = 0;
            for (int r = ROWS - 1; r >= 0; r--) {
                int idx = r * COLS + c;
                if (type[idx] >= 0) {
                    keepType[n] = type[idx];
                    keepVal[n] = val[idx];
                    n++;
                }
            }
            for (int k = 0; k < n; k++) {
                int idx = (ROWS - 1 - k) * COLS + c;
                type[idx] = keepType[k];
                val[idx] = keepVal[k];
            }
            for (int r = ROWS - 1 - n; r >= 0; r--) {
                fillCell(type, val, r * COLS + c, orbChance, awakened);
            }
        }
    }

    private List<SethCell> snapshot(int[] type, int[] val) {
        List<SethCell> cells = new ArrayList<>(CELLS);
        for (int i = 0; i < CELLS; i++) cells.add(new SethCell(type[i], val[i]));
        return cells;
    }

    private int pickSymbol() {
        int total = 0;
        for (int w : SYMBOL_WEIGHTS) total += w;
        int r = random.nextInt(total);
        int acc = 0;
        for (int i = 0; i < SYMBOL_WEIGHTS.length; i++) {
            acc += SYMBOL_WEIGHTS[i];
            if (r < acc) return i;
        }
        return SYMBOL_WEIGHTS.length - 1;
    }

    private int pickOrbValue(boolean awakened) {
        int[] weights = awakened ? ORB_WEIGHTS_AWAKENED : ORB_WEIGHTS;
        int total = 0;
        for (int w : weights) total += w;
        int r = random.nextInt(total);
        int acc = 0;
        for (int i = 0; i < weights.length; i++) {
            acc += weights[i];
            if (r < acc) return ORB_VALUES[i];
        }
        return ORB_VALUES[ORB_VALUES.length - 1];
    }
}
