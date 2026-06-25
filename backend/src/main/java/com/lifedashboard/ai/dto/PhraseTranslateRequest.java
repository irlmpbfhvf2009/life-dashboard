package com.lifedashboard.ai.dto;

import jakarta.validation.constraints.NotBlank;

/** A request to translate {@code message} into the travel language {@code lang}. */
public record PhraseTranslateRequest(
        @NotBlank(message = "message is required")
        String message,
        /** Target language name (e.g. "Thai", "Japanese", "Korean", "Vietnamese"). */
        String lang
) {
}
