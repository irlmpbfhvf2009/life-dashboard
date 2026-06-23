package com.lifedashboard.food.dto;

import com.lifedashboard.food.FoodRecord;
import com.lifedashboard.food.MealType;

import java.time.Instant;
import java.time.LocalDate;

public record FoodDto(
        Long id,
        LocalDate date,
        MealType mealType,
        String foodText,
        String note,
        Instant createdAt
) {
    public static FoodDto from(FoodRecord f) {
        return new FoodDto(f.getId(), f.getDate(), f.getMealType(), f.getFoodText(),
                f.getNote(), f.getCreatedAt());
    }
}
