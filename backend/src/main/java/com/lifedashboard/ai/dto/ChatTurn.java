package com.lifedashboard.ai.dto;

/**
 * One turn of conversation. {@code role} is "user" or "model" (Gemini's naming);
 * the frontend sends prior turns so the coach has context.
 */
public record ChatTurn(String role, String content) {
}
