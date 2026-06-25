package com.lifedashboard.ai.dto;

/** Expense fields extracted from a receipt photo. */
public record ReceiptReply(
        double amount,
        String currency,
        String category,
        String note,
        String date
) {
}
