package com.lifedashboard.travel;

import java.time.Instant;

/** Lightweight view of one of the user's shared links (for the "my shares" list). */
public record SharedTripSummary(
        String token,
        Instant createdAt,
        String destination,
        String departDate,
        int stops
) {}
