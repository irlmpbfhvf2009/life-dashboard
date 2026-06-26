package com.lifedashboard.goal.dto;

import com.lifedashboard.goal.GoalStatus;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;

public record UpdateGoalRequest(
        @Size(max = 120)
        String title,

        @Size(max = 5000)
        String description,

        Double targetValue,

        Double currentValue,

        @Size(max = 24)
        String unit,

        LocalDate deadline,

        GoalStatus status,

        @Size(max = 24)
        String color
) {
}
