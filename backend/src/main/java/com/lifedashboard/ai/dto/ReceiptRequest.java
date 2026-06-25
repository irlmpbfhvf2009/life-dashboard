package com.lifedashboard.ai.dto;

import jakarta.validation.constraints.NotBlank;

import java.util.List;

/** A receipt photo to extract expense fields from. {@code image} is raw base64 (no data: prefix). */
public record ReceiptRequest(
        @NotBlank(message = "image is required")
        String image,
        String mimeType,
        /** Expected currency code (the active trip currency) — used when the receipt is ambiguous. */
        String currency,
        /** Allowed categories to map onto. */
        List<String> categories
) {
}
