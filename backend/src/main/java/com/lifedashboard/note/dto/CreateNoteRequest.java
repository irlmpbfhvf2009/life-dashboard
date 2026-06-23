package com.lifedashboard.note.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record CreateNoteRequest(
        @NotBlank(message = "title is required")
        @Size(max = 255)
        String title,

        @Size(max = 20000)
        String content
) {
}
