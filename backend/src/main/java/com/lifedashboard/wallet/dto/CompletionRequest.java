package com.lifedashboard.wallet.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;

/** Client-reported daily completion. The server clamps both fields and only
 *  ever pays the once-per-day difference, so this can't be farmed for coins. */
public record CompletionRequest(
        @Min(0) @Max(1) double progress,
        @Min(1) @Max(100) int level
) {
}
