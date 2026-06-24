package com.lifedashboard.expense.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.LocalDate;

public record CreateExpenseRequest(
        @NotNull(message = "date is required")
        LocalDate date,

        @NotNull(message = "amount is required")
        @DecimalMin(value = "0.0", inclusive = false, message = "amount must be positive")
        BigDecimal amount,

        @NotBlank(message = "category is required")
        @Size(max = 64)
        String category,

        /** "EXPENSE" or "INCOME"; null/blank defaults to EXPENSE in the service. */
        @Pattern(regexp = "EXPENSE|INCOME", message = "type must be EXPENSE or INCOME")
        String type,

        @Size(max = 2000)
        String description
) {
}
