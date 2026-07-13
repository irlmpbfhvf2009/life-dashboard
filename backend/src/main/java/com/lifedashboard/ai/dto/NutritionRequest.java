package com.lifedashboard.ai.dto;

/**
 * One food item / meal or one exercise the user logged, by free text and/or a
 * photo. {@code image} is raw base64 (no {@code data:} prefix). At least one of
 * {@code text} / {@code image} must be present. {@code weightKg} (optional) lets
 * the model do a proper MET-based calorie-burn estimate for exercise entries.
 */
public record NutritionRequest(String text, String image, String mimeType, Double weightKg) {
}
