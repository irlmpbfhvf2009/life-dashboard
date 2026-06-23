package com.lifedashboard.wallet;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.Instant;
import java.time.LocalDate;

/**
 * Server-authoritative virtual coin balance for a user. Keeping the balance and
 * the once-per-day grant logic on the server (not localStorage) is what makes
 * the currency tamper-resistant: the client can only *request* a grant, never
 * set the balance directly.
 */
@Entity
@Table(name = "wallets", indexes = {
        @Index(name = "idx_wallet_user", columnList = "user_id", unique = true)
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Wallet {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false, unique = true)
    private Long userId;

    @Column(nullable = false)
    @Builder.Default
    private long coins = 0;

    /** Last date the +50 daily login bonus was granted. */
    @Column(name = "last_bonus_date")
    private LocalDate lastBonusDate;

    /** Last date a completion reward was settled. */
    @Column(name = "last_reward_date")
    private LocalDate lastRewardDate;

    /** Coins already paid for today's completion (so we only top up the diff). */
    @Column(name = "reward_paid", nullable = false)
    @Builder.Default
    private int rewardPaid = 0;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;
}
