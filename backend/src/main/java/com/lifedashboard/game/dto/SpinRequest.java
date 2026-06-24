package com.lifedashboard.game.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;

public record SpinRequest(@Min(1) @Max(1000) long bet) {
}
