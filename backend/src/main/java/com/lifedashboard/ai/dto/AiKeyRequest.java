package com.lifedashboard.ai.dto;

/** A member-supplied AI setup to save: which provider, which model, and the key. */
public record AiKeyRequest(String provider, String model, String apiKey) {
}
