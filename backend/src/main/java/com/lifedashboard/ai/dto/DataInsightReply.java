package com.lifedashboard.ai.dto;

import java.util.List;

/** AI-generated insights for an uploaded dataset (all text in Traditional Chinese). */
public record DataInsightReply(
        String summary,
        List<String> findings,
        List<String> suggestions
) {
}
