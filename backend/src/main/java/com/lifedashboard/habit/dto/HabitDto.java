package com.lifedashboard.habit.dto;

import java.time.Instant;
import java.util.List;

public record HabitDto(
        Long id,
        String name,
        String emoji,
        String color,
        int targetPerDay,
        int todayCount,
        boolean doneToday,
        int streak,
        List<DayStatus> recentDays,
        Instant createdAt
) {
}
