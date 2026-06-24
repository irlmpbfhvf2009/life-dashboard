package com.lifedashboard.wallet;

import com.lifedashboard.security.CurrentUserService;
import com.lifedashboard.wallet.dto.WalletDto;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class WalletService {

    private final WalletRepository walletRepository;
    private final CurrentUserService currentUserService;

    private Wallet getOrCreate(Long userId) {
        return walletRepository.findByUserId(userId)
                .orElseGet(() -> walletRepository.save(Wallet.builder().userId(userId).build()));
    }

    @Transactional(readOnly = true)
    public long balanceOf(Long userId) {
        return walletRepository.findByUserId(userId).map(Wallet::getCoins).orElse(0L);
    }

    /** Apply a signed delta to a user's balance (admin grants, game bets/wins).
     *  Floors at zero. Returns the new balance. */
    @Transactional
    public long applyDelta(Long userId, long delta) {
        Wallet w = getOrCreate(userId);
        long next = Math.max(0, w.getCoins() + delta);
        w.setCoins(next);
        walletRepository.save(w);
        return next;
    }

    @Transactional
    public WalletDto getWallet() {
        return WalletDto.from(getOrCreate(currentUserService.getCurrentUserId()));
    }
}
