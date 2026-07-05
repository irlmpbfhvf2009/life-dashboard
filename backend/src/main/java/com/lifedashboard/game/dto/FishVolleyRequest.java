package com.lifedashboard.game.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

import java.util.List;

/**
 * One batched "volley" from the fish-hunter client: how many shots were fired
 * since the last flush (each shot costs {@code bet}), and the fish types hit
 * by bullets in that window (each hit is an independent server-side kill roll).
 */
public record FishVolleyRequest(
        @Min(1) @Max(1000) long bet,
        @Min(0) @Max(120) int shots,
        @NotNull List<Integer> hits
) {
}
