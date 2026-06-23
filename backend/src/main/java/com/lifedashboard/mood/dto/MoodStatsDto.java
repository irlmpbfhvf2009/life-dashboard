package com.lifedashboard.mood.dto;

import java.util.List;
import java.util.Map;

public record MoodStatsDto(
        int count,
        Double average,
        Map<Integer, Long> distribution,   // moodScore -> count, for scores 1..5
        List<MoodDto> points                // chronological points within range
) {
}
