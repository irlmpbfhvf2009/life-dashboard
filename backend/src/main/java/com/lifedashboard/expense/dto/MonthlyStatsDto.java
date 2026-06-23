package com.lifedashboard.expense.dto;

import java.math.BigDecimal;
import java.util.List;

public record MonthlyStatsDto(
        String month,                 // e.g. "2026-06"
        BigDecimal total,             // total for the requested month
        List<CategoryBreakdown> byCategory
) {
    public record CategoryBreakdown(String category, BigDecimal total) {
    }
}
