package com.lifedashboard.goal.dto;

import com.lifedashboard.goal.Goal;
import com.lifedashboard.goal.GoalStatus;

import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;

public record GoalDto(
        Long id,
        String title,
        String description,
        double targetValue,
        double currentValue,
        String unit,
        LocalDate deadline,
        GoalStatus status,
        String color,
        int progressPct,
        Long daysLeft,
        Instant createdAt
) {
    public static GoalDto from(Goal g) {
        int pct = g.getTargetValue() > 0
                ? (int) Math.min(100, Math.round(g.getCurrentValue() / g.getTargetValue() * 100))
                : 0;
        Long daysLeft = g.getDeadline() != null
                ? ChronoUnit.DAYS.between(LocalDate.now(), g.getDeadline())
                : null;
        return new GoalDto(g.getId(), g.getTitle(), g.getDescription(), g.getTargetValue(),
                g.getCurrentValue(), g.getUnit(), g.getDeadline(), g.getStatus(), g.getColor(),
                pct, daysLeft, g.getCreatedAt());
    }
}
