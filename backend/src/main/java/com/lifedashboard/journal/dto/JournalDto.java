package com.lifedashboard.journal.dto;

import com.lifedashboard.journal.Journal;

import java.time.Instant;
import java.time.LocalDate;

public record JournalDto(
        Long id,
        String title,
        String content,
        LocalDate entryDate,
        String mood,
        Instant createdAt,
        Instant updatedAt
) {
    public static JournalDto from(Journal j) {
        return new JournalDto(j.getId(), j.getTitle(), j.getContent(), j.getEntryDate(),
                j.getMood(), j.getCreatedAt(), j.getUpdatedAt());
    }
}
