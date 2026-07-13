package com.lifedashboard.ai.dto;

import java.util.List;

/**
 * The AI's structured estimate for a single logged item.
 *
 * @param kind         "food" or "exercise"
 * @param label        short zh-TW name of the item
 * @param calories     for food = calories eaten; for exercise = calories burned (positive)
 * @param protein      grams of protein (0 for exercise)
 * @param fiber        grams of dietary fibre, part of carbs (0 for exercise)
 * @param starch       grams of starch, part of carbs (0 for exercise)
 * @param sugar        grams of total sugars, part of carbs (0 for exercise)
 * @param carbs        grams of total carbohydrate — roughly fiber + starch + sugar (0 for exercise)
 * @param fat          grams of total fat (0 for exercise)
 * @param saturatedFat grams of saturated fat, part of fat (0 for exercise)
 * @param addedSugar   grams of sugar added during processing/preparation, not naturally occurring (0 for exercise)
 * @param sodium       milligrams of sodium (0 for exercise)
 * @param keyNutrients notable vitamins / minerals present, short zh-TW tags
 * @param note         one short zh-TW comment
 */
public record NutritionEntryReply(
        String kind,
        String label,
        int calories,
        double protein,
        double fiber,
        double starch,
        double sugar,
        double carbs,
        double fat,
        double saturatedFat,
        double addedSugar,
        double sodium,
        List<String> keyNutrients,
        String note) {
}
