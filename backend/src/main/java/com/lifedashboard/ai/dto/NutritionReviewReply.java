package com.lifedashboard.ai.dto;

import java.util.List;

/**
 * The AI's daily nutrition verdict for the health module.
 *
 * @param balanceScore 0–100, how balanced today's nutrition is
 * @param verdict      one-sentence overall assessment (zh-TW)
 * @param lacking      nutrients that fell short today, each with a short reason
 * @param suggestions  concrete foods to eat to fill the gaps (zh-TW)
 * @param calorieNote  one sentence on the calorie deficit / surplus (zh-TW)
 */
public record NutritionReviewReply(
        int balanceScore,
        String verdict,
        List<Gap> lacking,
        List<String> suggestions,
        String calorieNote) {

    /** A nutrient the user is short on today. */
    public record Gap(String nutrient, String note) {}
}
