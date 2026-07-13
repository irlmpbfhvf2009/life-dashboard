package com.lifedashboard.ai;

/** The resolved AI setup for the current request: which provider/model/key to call. */
public record AiConfig(AiProvider provider, String apiKey, String model, boolean vision) {
}
