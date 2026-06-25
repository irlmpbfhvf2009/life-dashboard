package com.lifedashboard.social.dto;

import com.lifedashboard.social.SocialPrivacy;

/** The owner's per-module visibility switches. */
public record PrivacyDto(
        boolean shareHealth,
        boolean shareMood,
        boolean shareLife
) {
    public static PrivacyDto from(SocialPrivacy p) {
        if (p == null) return new PrivacyDto(false, false, false);
        return new PrivacyDto(p.isShareHealth(), p.isShareMood(), p.isShareLife());
    }
}
