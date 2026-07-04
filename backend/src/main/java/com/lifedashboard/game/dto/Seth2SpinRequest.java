package com.lifedashboard.game.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

/**
 * A Seth II spin request. {@code buy} selects the feature purchase:
 * NONE = normal spin, FREE = buy free games (200x, chance to awaken),
 * AWAKEN = buy awakened free games (500x), IMMORTAL = awakened free games
 * with a guaranteed x500 orb and orb splitting (2000x).
 */
public record Seth2SpinRequest(
        @Min(1) @Max(1000) long bet,
        @NotNull Buy buy
) {
    public enum Buy { NONE, FREE, AWAKEN, IMMORTAL }
}
