package com.lifedashboard.veggie;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.Instant;

/**
 * One "best run" row per user, per (mode, players, dailyKey) bucket for the
 * 菜菜勇者團 leaderboard. Only the player's personal best in each bucket is kept
 * (upserted on submit), so the table stays small and "my rank" is a single count.
 *
 * dailyKey = "" for the all-time boards; = "YYYY-MM-DD" (Asia/Taipei) for the
 * daily challenge board so each day has its own ranking.
 *
 * Name/photo are denormalized (snapshotted at submit time) so the board renders
 * without joining users — and stays cheap for the public-ish leaderboard read.
 */
@Entity
@Table(name = "veggie_score", uniqueConstraints = @UniqueConstraint(
        name = "uq_veggie_bucket", columnNames = {"user_id", "mode", "players", "daily_key"}))
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class VeggieScore {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(nullable = false, length = 32)
    private String name;

    @Column(name = "photo_url", length = 1024)
    private String photoUrl;

    /** quick | standard | endless | daily */
    @Column(nullable = false, length = 16)
    private String mode;

    /** 1~4 */
    @Column(nullable = false)
    private int players;

    /** highest wave reached */
    @Column(nullable = false)
    private int wave;

    @Column(nullable = false)
    private int kills;

    @Column(name = "duration_sec", nullable = false)
    private int durationSec;

    /** "" for all-time boards, "YYYY-MM-DD" for the daily challenge board */
    @Column(name = "daily_key", nullable = false, length = 10)
    private String dailyKey;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;
}
