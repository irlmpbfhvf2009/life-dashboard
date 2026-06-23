package com.lifedashboard.weight.dto;

import java.math.BigDecimal;
import java.util.List;

public record WeightStatsDto(
        String range,
        int count,
        BigDecimal min,
        BigDecimal max,
        BigDecimal average,
        BigDecimal change,
        List<WeightDto> points
) {
}
