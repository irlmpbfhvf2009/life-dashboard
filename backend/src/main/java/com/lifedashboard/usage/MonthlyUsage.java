package com.lifedashboard.usage;

import jakarta.persistence.*;
import lombok.*;

/**
 * A single counter row per calendar month tracking how many API requests this
 * deployment has served. Used to render an approximate free-tier usage bar.
 * This is app-owned data (no external billing API needed).
 */
@Entity
@Table(name = "monthly_usage")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class MonthlyUsage {

    @Id
    @Column(name = "year_month", length = 7) // e.g. "2026-06"
    private String yearMonth;

    @Column(name = "request_count", nullable = false)
    private long requestCount;
}
