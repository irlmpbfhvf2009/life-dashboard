package com.lifedashboard.expense.dto;

import com.lifedashboard.expense.Expense;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

public record ExpenseDto(
        Long id,
        LocalDate date,
        BigDecimal amount,
        String category,
        String type,
        String description,
        Instant createdAt
) {
    public static ExpenseDto from(Expense e) {
        return new ExpenseDto(e.getId(), e.getDate(), e.getAmount(), e.getCategory(),
                e.getType(), e.getDescription(), e.getCreatedAt());
    }
}
