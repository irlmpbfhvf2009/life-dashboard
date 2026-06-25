package com.lifedashboard.ai.dto;

import jakarta.validation.constraints.NotBlank;

/** Request AI sightseeing suggestions for {@code place} over {@code days} days. */
public record SpotRequest(
        @NotBlank(message = "place is required")
        String place,
        int days
) {
}
