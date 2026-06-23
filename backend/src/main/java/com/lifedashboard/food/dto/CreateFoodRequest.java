package com.lifedashboard.food.dto;

import com.lifedashboard.food.MealType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;

public record CreateFoodRequest(
        @NotNull(message = "date is required")
        LocalDate date,

        @NotNull(message = "mealType is required")
        MealType mealType,

        @NotBlank(message = "foodText is required")
        @Size(max = 2000)
        String foodText,

        @Size(max = 1000)
        String note
) {
}
