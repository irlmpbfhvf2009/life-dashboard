package com.lifedashboard.fasting.dto;

public record FastingStatsDto(
        int totalSessions,
        int completedSessions,
        int currentStreakDays,
        long longestMinutes,
        long avgMinutes,
        int thisWeekCount
) {
}
