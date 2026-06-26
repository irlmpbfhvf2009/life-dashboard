package com.lifedashboard.ai.dto;

import java.util.List;

/** AI-generated daily brief for the home command center. */
public record BriefReply(
        String brief,
        String suggestion,
        List<BriefInsight> insights
) {
    public record BriefInsight(String title, String text) {
    }
}
