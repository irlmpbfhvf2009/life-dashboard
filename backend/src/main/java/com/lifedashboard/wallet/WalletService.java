package com.lifedashboard.wallet;

import com.lifedashboard.security.CurrentUserService;
import com.lifedashboard.wallet.dto.CompletionRequest;
import com.lifedashboard.wallet.dto.GrantResultDto;
import com.lifedashboard.wallet.dto.WalletDto;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;

@Service
@RequiredArgsConstructor
public class WalletService {

    private static final int DAILY_BONUS = 50;

    private final WalletRepository walletRepository;
    private final CurrentUserService currentUserService;

    private Wallet getOrCreate(Long userId) {
        return walletRepository.findByUserId(userId)
                .orElseGet(() -> walletRepository.save(Wallet.builder().userId(userId).build()));
    }

    @Transactional
    public WalletDto getWallet() {
        return WalletDto.from(getOrCreate(currentUserService.getCurrentUserId()));
    }

    /** Grant the +50 daily login bonus, at most once per calendar day. */
    @Transactional
    public GrantResultDto claimDailyBonus() {
        Wallet w = getOrCreate(currentUserService.getCurrentUserId());
        LocalDate today = LocalDate.now();
        long granted = 0;
        if (!today.equals(w.getLastBonusDate())) {
            w.setLastBonusDate(today);
            w.setCoins(w.getCoins() + DAILY_BONUS);
            granted = DAILY_BONUS;
            walletRepository.save(w);
        }
        return new GrantResultDto(granted, w.getCoins());
    }

    /**
     * Settle today's completion reward: perfect day = level×10, ≥70% = level×5.
     * Only the difference vs. what was already paid today is granted, so this is
     * idempotent and can't be farmed. progress/level are clamped by validation.
     */
    @Transactional
    public GrantResultDto settleCompletion(CompletionRequest req) {
        Wallet w = getOrCreate(currentUserService.getCurrentUserId());
        LocalDate today = LocalDate.now();
        if (!today.equals(w.getLastRewardDate())) {
            w.setLastRewardDate(today);
            w.setRewardPaid(0);
        }
        int target = req.progress() >= 1.0 ? req.level() * 10
                : req.progress() >= 0.7 ? req.level() * 5
                : 0;
        long granted = Math.max(0, target - w.getRewardPaid());
        if (granted > 0) {
            w.setCoins(w.getCoins() + granted);
            w.setRewardPaid(target);
            walletRepository.save(w);
        }
        return new GrantResultDto(granted, w.getCoins());
    }
}
