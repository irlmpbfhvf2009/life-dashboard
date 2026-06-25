package com.lifedashboard.game.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;

/**
 * A Seth slot spin request. {@code ante} raises the stake for a higher scatter
 * frequency; {@code buyBonus} pays a fixed multiple of the bet to jump straight
 * into the free-spin session. The two are mutually exclusive (buyBonus wins).
 */
public record SethSpinRequest(
        @Min(1) @Max(1000) long bet,
        boolean ante,
        boolean buyBonus
) {
}
