package com.lifedashboard.game;

import com.lifedashboard.common.exception.ForbiddenException;
import com.lifedashboard.game.dto.SethCell;
import com.lifedashboard.game.dto.SethRound;
import com.lifedashboard.game.dto.SethSpinResult;
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
 * "法老寶藏" — a Gates-of-Olympus-style tumble (cascade) slot, for learning only
 * (virtual coins, no real money). Everything that decides the outcome runs
 * server-side and is returned as a replayable sequence of frames, so the client
 * can only animate — it can't influence the result or the wallet.
 *
 * <p>Mechanics: a 6×5 board pays by "scatter pays" — 8 or more of one symbol
 * anywhere on the board wins. Winning symbols are removed, the rest tumble down
 * and new symbols fill the top; this repeats until no win. Multiplier orbs that
 * land during a winning sequence sum up and multiply that sequence's pay. Four
 * or more scatters award a free-spin session where the orb multiplier persists
 * and accumulates across spins.</p>
 *
 * <p>Two staking options mirror the genre: <b>ante</b> raises the stake to buy a
 * higher scatter frequency, and <b>bonus buy</b> pays a fixed multiple of the
 * bet to jump straight into the free-spin session.</p>
 */
@Service
@RequiredArgsConstructor
public class SethSlotService {

    private static final int COLS = 6;
    private static final int ROWS = 5;
    private static final int CELLS = COLS * ROWS; // 30

    /** 8 pay symbols, low → high. Relative drop weights (rarer = pays more). */
    private static final int[] SYMBOL_WEIGHTS = {22, 20, 18, 15, 12, 9, 6, 4};
    /**
     * Pay as a multiple of the total bet, indexed [symbol][tier],
     * tier 0 = 8–9 of a kind, 1 = 10–11, 2 = 12+.
     */
    private static final double[][] PAYTABLE = {
            {0.07, 0.16, 0.50},  // 0 blue gem
            {0.10, 0.24, 0.70},  // 1 green gem
            {0.14, 0.34, 1.0},   // 2 purple gem
            {0.20, 0.50, 1.7},   // 3 yellow gem
            {0.34, 0.70, 2.7},   // 4 red gem
            {0.50, 1.0, 4.0},    // 5 chalice
            {0.85, 2.0, 8.0},    // 6 ring
            {1.7, 4.0, 13.0},    // 7 crown / ankh (top symbol)
    };

    /** Possible multiplier-orb values and their relative weights (small = common). */
    private static final int[] ORB_VALUES = {2, 3, 4, 5, 6, 8, 10, 15, 20, 25, 50, 100};
    private static final int[] ORB_WEIGHTS = {320, 240, 150, 90, 55, 35, 20, 10, 6, 4, 2, 1};

    // Per-cell chance of a special symbol when a new cell is generated.
    private static final double ORB_CHANCE_BASE = 0.010;
    private static final double ORB_CHANCE_FREE = 0.047; // free spins drop more orbs
    private static final double SCATTER_CHANCE = 0.0163; // natural free-spin trigger ≈ 0.5%

    private static final int FREE_SPINS_AWARD = 15;   // 4+ scatters (or bonus buy)
    private static final int FREE_SPINS_RETRIGGER = 5; // 3+ scatters during free spins
    private static final int FREE_SPINS_CAP = 60;
    private static final int FREE_MULT_CAP = 500;      // bound the persistent free-spin multiplier
    private static final long MAX_PAYOUT_MULTIPLE = 5000; // cap total win at bet × this

    private static final double ANTE_COST_MULT = 1.25;    // ante stake = bet × this
    private static final double ANTE_SCATTER_MULT = 1.13; // ante boosts scatter frequency (≈1.5× trigger)
    private static final long BONUS_BUY_COST = 100;      // bonus buy = bet × this

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

    public SethSpinResult spin(long bet, boolean ante, boolean buyBonus) {
        User user = requirePlayer();
        Long userId = user.getId();

        Outcome outcome = resolvePurchase(bet, ante, buyBonus);

        long balance = walletService.balanceOf(userId);
        if (balance < outcome.cost()) {
            throw new ForbiddenException("Insufficient coins");
        }

        long newBalance = walletService.applyDelta(userId, outcome.cappedWin() - outcome.cost());
        return new SethSpinResult(bet, outcome.cost(), outcome.rounds(), outcome.freeSpins(),
                outcome.cappedWin(), newBalance);
    }

    /** Result of one purchase: rounds, free spins awarded, the (capped) total win, and what it cost. */
    record Outcome(List<SethRound> rounds, int freeSpins, long cappedWin, long cost) {
    }

    /**
     * Pure engine: resolve one purchase (no wallet / auth side effects), so it can
     * be exercised directly in tests.
     *
     * @param ante     raise the stake for a higher scatter frequency
     * @param buyBonus pay a fixed multiple to jump straight into free spins
     */
    Outcome resolvePurchase(long bet, boolean ante, boolean buyBonus) {
        long cost = buyBonus ? bet * BONUS_BUY_COST
                : ante ? Math.round(bet * ANTE_COST_MULT)
                : bet;
        double scatterChance = ante ? SCATTER_CHANCE * ANTE_SCATTER_MULT : SCATTER_CHANCE;

        List<SethRound> rounds = new ArrayList<>();
        long totalWin = 0;
        boolean enterFreeSpins = buyBonus;

        // --- Base round (skipped when buying the bonus) ---
        if (!buyBonus) {
            RoundResult base = resolveRound(bet, false, 1, 0, 0, scatterChance);
            rounds.add(base.round);
            totalWin += base.round.pay();
            enterFreeSpins = base.scatterCount >= 4;
        }

        // --- Free spins ---
        int freeSpinsAwarded = 0;
        if (enterFreeSpins) {
            freeSpinsAwarded = FREE_SPINS_AWARD;
            int remaining = FREE_SPINS_AWARD;
            int played = 0;
            int persistentMult = 0; // carries across the whole session
            while (remaining > 0) {
                remaining--;
                played++;
                RoundResult fs = resolveRound(bet, true, persistentMult, played,
                        Math.max(played + remaining, FREE_SPINS_AWARD), SCATTER_CHANCE);
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

    /** Carries a round's frames plus the bits the caller needs to chain rounds. */
    private record RoundResult(SethRound round, int scatterCount, int persistentMult) {
    }

    /**
     * Resolve one spin's full tumble sequence.
     *
     * @param incomingMult   the running multiplier carried in (free spins); 1 in base game
     * @param scatterChance  per-cell scatter probability (ante raises it in the base game)
     */
    private RoundResult resolveRound(long bet, boolean freeSpin, int incomingMult,
                                     int spinIndex, int spinTotal, double scatterChance) {
        int[] type = new int[CELLS];
        int[] val = new int[CELLS];
        double orbChance = freeSpin ? ORB_CHANCE_FREE : ORB_CHANCE_BASE;
        for (int i = 0; i < CELLS; i++) fillCell(type, val, i, orbChance, scatterChance);

        List<SethTumble> tumbles = new ArrayList<>();
        long seqPay = 0;

        while (true) {
            int[] counts = new int[8];
            for (int i = 0; i < CELLS; i++) {
                if (type[i] >= 0 && type[i] < 8) counts[type[i]]++;
            }

            List<Integer> winPositions = new ArrayList<>();
            long framePay = 0;
            for (int s = 0; s < 8; s++) {
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
            for (int i : winPositions) type[i] = -1; // remove winners
            tumbleDown(type, val, orbChance, scatterChance);
        }

        // Specials surviving on the final board.
        int orbSum = 0;
        int scatterCount = 0;
        for (int i = 0; i < CELLS; i++) {
            if (type[i] == SethCell.ORB) orbSum += val[i];
            else if (type[i] == SethCell.SCATTER) scatterCount++;
        }

        long roundPay;
        int appliedMult;
        if (seqPay > 0) {
            if (freeSpin) {
                // Free spins: orbs add into the persistent multiplier, which then applies.
                int persistent = Math.min(incomingMult + orbSum, FREE_MULT_CAP);
                appliedMult = Math.max(persistent, 1);
                roundPay = seqPay * appliedMult;
                SethRound round = new SethRound("FREE", tumbles, appliedMult, roundPay, spinIndex, spinTotal);
                return new RoundResult(round, scatterCount, persistent);
            }
            // Base game: this sequence's orbs apply to this sequence only.
            appliedMult = orbSum > 0 ? orbSum : 1;
            roundPay = seqPay * appliedMult;
        } else {
            appliedMult = 1;
            roundPay = 0;
        }
        SethRound round = new SethRound(freeSpin ? "FREE" : "BASE", tumbles, appliedMult,
                roundPay, spinIndex, spinTotal);
        return new RoundResult(round, scatterCount, incomingMult);
    }

    // ----- board helpers -----

    private void fillCell(int[] type, int[] val, int i, double orbChance, double scatterChance) {
        double r = random.nextDouble();
        if (r < orbChance) {
            type[i] = SethCell.ORB;
            val[i] = pickOrbValue();
        } else if (r < orbChance + scatterChance) {
            type[i] = SethCell.SCATTER;
            val[i] = 0;
        } else {
            type[i] = pickSymbol();
            val[i] = 0;
        }
    }

    /** Gravity: in each column, surviving cells fall to the bottom; new cells fill the top. */
    private void tumbleDown(int[] type, int[] val, double orbChance, double scatterChance) {
        for (int c = 0; c < COLS; c++) {
            int[] keepType = new int[ROWS];
            int[] keepVal = new int[ROWS];
            int n = 0;
            // bottom → top, collecting survivors in order
            for (int r = ROWS - 1; r >= 0; r--) {
                int idx = r * COLS + c;
                if (type[idx] >= 0) {
                    keepType[n] = type[idx];
                    keepVal[n] = val[idx];
                    n++;
                }
            }
            // write survivors back to the bottom
            for (int k = 0; k < n; k++) {
                int idx = (ROWS - 1 - k) * COLS + c;
                type[idx] = keepType[k];
                val[idx] = keepVal[k];
            }
            // fill the remaining top cells with fresh symbols
            for (int r = ROWS - 1 - n; r >= 0; r--) {
                fillCell(type, val, r * COLS + c, orbChance, scatterChance);
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

    private int pickOrbValue() {
        int total = 0;
        for (int w : ORB_WEIGHTS) total += w;
        int r = random.nextInt(total);
        int acc = 0;
        for (int i = 0; i < ORB_WEIGHTS.length; i++) {
            acc += ORB_WEIGHTS[i];
            if (r < acc) return ORB_VALUES[i];
        }
        return ORB_VALUES[ORB_VALUES.length - 1];
    }
}
