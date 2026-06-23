package com.lifedashboard.note.dto;

import com.lifedashboard.note.Note;

import java.time.Instant;

public record NoteDto(
        Long id,
        String title,
        String content,
        Instant createdAt,
        Instant updatedAt
) {
    public static NoteDto from(Note n) {
        return new NoteDto(n.getId(), n.getTitle(), n.getContent(), n.getCreatedAt(), n.getUpdatedAt());
    }
}
