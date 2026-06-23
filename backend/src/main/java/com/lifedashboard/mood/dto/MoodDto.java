package com.lifedashboard.mood.dto;

import com.lifedashboard.mood.MoodRecord;

import java.time.Instant;
import java.time.LocalDate;

public record MoodDto(
        Long id,
        LocalDate date,
        Integer moodScore,
        String note,
        Instant createdAt
) {
    public static MoodDto from(MoodRecord m) {
        return new MoodDto(m.getId(), m.getDate(), m.getMoodScore(), m.getNote(), m.getCreatedAt());
    }
}
