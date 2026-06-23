package com.lifedashboard.weight.dto;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.LocalDate;

public record CreateWeightRequest(
        @NotNull(message = "date is required")
        LocalDate date,

        @NotNull(message = "weight is required")
        @DecimalMin(value = "0.0", inclusive = false, message = "weight must be positive")
        @DecimalMax(value = "999.99", message = "weight is too large")
        BigDecimal weight,

        @Size(max = 1000)
        String note
) {
}
