package com.lifedashboard.wallet.dto;

import com.lifedashboard.wallet.Wallet;

import java.time.LocalDate;

public record WalletDto(long coins, LocalDate lastBonusDate, boolean claimedToday) {
    public static WalletDto from(Wallet w) {
        boolean claimed = w.getLastBonusDate() != null && w.getLastBonusDate().equals(LocalDate.now());
        return new WalletDto(w.getCoins(), w.getLastBonusDate(), claimed);
    }
}
