package com.lifedashboard.ai.dto;

import jakarta.validation.constraints.NotBlank;

/** Request AI local-food recommendations for {@code place}. */
public record FoodRequest(
        @NotBlank(message = "place is required")
        String place
) {
}
