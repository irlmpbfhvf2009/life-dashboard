package com.lifedashboard.weight.dto;

import com.lifedashboard.weight.WeightRecord;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

public record WeightDto(
        Long id,
        LocalDate date,
        BigDecimal weight,
        String note,
        Instant createdAt
) {
    public static WeightDto from(WeightRecord w) {
        return new WeightDto(w.getId(), w.getDate(), w.getWeight(), w.getNote(), w.getCreatedAt());
    }
}
