package com.lifedashboard.habit.dto;

import jakarta.validation.constraints.Size;

public record UpdateHabitRequest(
        @Size(max = 80)
        String name,

        @Size(max = 16)
        String emoji,

        @Size(max = 24)
        String color,

        Integer targetPerDay,

        Boolean archived
) {
}
