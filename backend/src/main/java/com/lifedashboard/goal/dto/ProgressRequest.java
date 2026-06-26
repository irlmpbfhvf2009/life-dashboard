package com.lifedashboard.goal.dto;

/** Add (or subtract, when negative) an amount to a goal's progress. */
public record ProgressRequest(double delta) {
}
