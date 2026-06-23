package com.lifedashboard.note.dto;

import jakarta.validation.constraints.Size;

public record UpdateNoteRequest(
        @Size(max = 255)
        String title,

        @Size(max = 20000)
        String content
) {
}
