package com.lifedashboard.habit.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record CreateHabitRequest(
        @NotBlank(message = "name is required")
        @Size(max = 80)
        String name,

        @Size(max = 16)
        String emoji,

        @Size(max = 24)
        String color,

        Integer targetPerDay
) {
}
