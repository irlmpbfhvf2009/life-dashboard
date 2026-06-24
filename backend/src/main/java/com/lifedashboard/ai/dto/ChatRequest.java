package com.lifedashboard.ai.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.util.List;

/**
 * A message from the learner plus the prior conversation turns for context.
 */
public record ChatRequest(
        @NotBlank(message = "message is required")
        @Size(max = 2000)
        String message,

        /** Prior turns (oldest first). May be null/empty for the first message. */
        List<ChatTurn> history
) {
}
