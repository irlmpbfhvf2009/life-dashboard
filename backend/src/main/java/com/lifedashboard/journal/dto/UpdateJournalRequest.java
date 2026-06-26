package com.lifedashboard.journal.dto;

import jakarta.validation.constraints.Size;

import java.time.LocalDate;

public record UpdateJournalRequest(
        @Size(max = 255)
        String title,

        @Size(max = 50000)
        String content,

        LocalDate entryDate,

        @Size(max = 16)
        String mood
) {
}
