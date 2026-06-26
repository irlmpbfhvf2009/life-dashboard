package com.lifedashboard.goal.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;

public record CreateGoalRequest(
        @NotBlank(message = "title is required")
        @Size(max = 120)
        String title,

        @Size(max = 5000)
        String description,

        @Positive(message = "targetValue must be positive")
        double targetValue,

        @Size(max = 24)
        String unit,

        LocalDate deadline,

        @Size(max = 24)
        String color
) {
}
