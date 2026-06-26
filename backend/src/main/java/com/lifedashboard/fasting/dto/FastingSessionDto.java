package com.lifedashboard.fasting.dto;

import com.lifedashboard.fasting.FastingSession;

import java.time.Duration;
import java.time.Instant;

public record FastingSessionDto(
        Long id,
        Instant startAt,
        Instant endAt,
        int targetHours,
        long elapsedMinutes,
        boolean active,
        boolean completed
) {
    public static FastingSessionDto from(FastingSession s) {
        boolean active = s.getEndAt() == null;
        Instant until = active ? Instant.now() : s.getEndAt();
        long minutes = Math.max(0, Duration.between(s.getStartAt(), until).toMinutes());
        boolean completed = minutes >= (long) s.getTargetHours() * 60;
        return new FastingSessionDto(s.getId(), s.getStartAt(), s.getEndAt(), s.getTargetHours(),
                minutes, active, completed);
    }
}
