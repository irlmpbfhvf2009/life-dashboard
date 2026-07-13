package com.lifedashboard.ai.dto;

/**
 * The current user's AI setup + availability, for the settings page.
 *
 * @param hasPersonalKey the user has saved their own key
 * @param provider       the chosen provider id (or the shared-key provider)
 * @param model          the chosen model id
 * @param masked         a masked hint of the saved key (last 4 chars), or null
 * @param aiAvailable    AI can be used right now for this user
 * @param usingSharedKey no personal key, but the shared admin key is being used
 * @param vision         the effective model can read images (photo features)
 */
public record AiKeyStatus(
        boolean hasPersonalKey,
        String provider,
        String model,
        String masked,
        boolean aiAvailable,
        boolean usingSharedKey,
        boolean vision) {
}
