package com.lifedashboard.ai.dto;

import java.util.List;

/**
 * The day's aggregated intake used to ask the AI for a nutrition verdict.
 *
 * @param maintenanceCalories estimated daily maintenance (TDEE) for the user
 * @param weightKg            body weight (to reason about protein needs)
 * @param intake              total calories eaten today
 * @param burned              total calories burned via logged exercise
 * @param protein             total grams of protein today
 * @param fiber               total grams of dietary fibre today
 * @param starch              total grams of starch today
 * @param sugar               total grams of total sugars today
 * @param carbs               total grams of carbohydrate today
 * @param fat                 total grams of fat today
 * @param saturatedFat        total grams of saturated fat today
 * @param addedSugar          total grams of added sugar today
 * @param sodium              total milligrams of sodium today
 * @param items               short labels of what was eaten today
 */
public record NutritionReviewRequest(
        int maintenanceCalories,
        double weightKg,
        int intake,
        int burned,
        double protein,
        double fiber,
        double starch,
        double sugar,
        double carbs,
        double fat,
        double saturatedFat,
        double addedSugar,
        double sodium,
        List<String> items) {
}
