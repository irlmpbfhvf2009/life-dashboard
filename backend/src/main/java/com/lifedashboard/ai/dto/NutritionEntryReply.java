package com.lifedashboard.ai.dto;

import java.util.List;

/**
 * The AI's structured estimate for a single logged item.
 *
 * @param kind         "food" or "exercise"
 * @param label        short zh-TW name of the item
 * @param calories     for food = calories eaten; for exercise = calories burned (positive)
 * @param protein      grams of protein (0 for exercise)
 * @param fiber        grams of dietary fibre (0 for exercise)
 * @param carbs        grams of carbohydrate (0 for exercise)
 * @param fat          grams of fat (0 for exercise)
 * @param keyNutrients notable vitamins / minerals present, short zh-TW tags
 * @param note         one short zh-TW comment
 */
public record NutritionEntryReply(
        String kind,
        String label,
        int calories,
        double protein,
        double fiber,
        double carbs,
        double fat,
        List<String> keyNutrients,
        String note) {
}
