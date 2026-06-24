package com.lifedashboard.ai.dto;

import java.util.List;

/**
 * Structured sentence correction returned by the English coach.
 * {@code explanationZh} is in Traditional Chinese; the English fields stay English.
 */
public record CorrectionReply(
        String original,
        String corrected,
        String natural,
        String explanationZh,
        List<String> grammarIssues,
        List<String> alternatives,
        List<String> examples
) {
}
