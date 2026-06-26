package com.lifedashboard.fasting.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;

public record StartFastingRequest(
        @Min(1) @Max(48)
        int targetHours
) {
}
