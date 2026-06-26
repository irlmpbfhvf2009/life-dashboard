package com.lifedashboard.habit.dto;

import java.time.LocalDate;

/** A single day's check-in state, used for the recent-days mini view. */
public record DayStatus(LocalDate date, int count, boolean done) {
}
