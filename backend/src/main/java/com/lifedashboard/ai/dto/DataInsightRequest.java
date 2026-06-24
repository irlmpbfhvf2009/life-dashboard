package com.lifedashboard.ai.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * A compact, pre-computed profile of an uploaded dataset (columns, row count,
 * numeric stats, sample rows) assembled by the frontend. We never send the raw
 * file — just this text summary — to keep payloads (and cost) bounded.
 */
public record DataInsightRequest(
        @NotBlank(message = "profile is required")
        @Size(max = 12000)
        String profile
) {
}
