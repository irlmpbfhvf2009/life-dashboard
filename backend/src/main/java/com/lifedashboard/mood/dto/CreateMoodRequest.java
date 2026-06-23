package com.lifedashboard.mood.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;

public record CreateMoodRequest(
        @NotNull(message = "date is required")
        LocalDate date,

        @NotNull(message = "moodScore is required")
        @Min(value = 1, message = "moodScore must be between 1 and 5")
        @Max(value = 5, message = "moodScore must be between 1 and 5")
        Integer moodScore,

        @Size(max = 1000)
        String note
) {
}
