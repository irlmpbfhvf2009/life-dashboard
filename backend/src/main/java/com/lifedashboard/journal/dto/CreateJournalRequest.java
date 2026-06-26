package com.lifedashboard.journal.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;

public record CreateJournalRequest(
        @NotBlank(message = "title is required")
        @Size(max = 255)
        String title,

        @Size(max = 50000)
        String content,

        LocalDate entryDate,

        @Size(max = 16)
        String mood
) {
}
