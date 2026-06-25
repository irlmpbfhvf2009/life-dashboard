package com.lifedashboard.ai.dto;

import java.util.List;

/** AI sightseeing suggestions. */
public record SpotReply(List<Spot> spots) {

    public record Spot(String name, String area, String reason, int day) {}
}
