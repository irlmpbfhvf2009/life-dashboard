package com.lifedashboard.social.dto;

import com.lifedashboard.user.User;

import java.time.Instant;

/**
 * A user as seen by someone else, tagged with their relationship to the viewer.
 * {@code relation} is one of NONE / REQUEST_SENT / REQUEST_RECEIVED / FRIEND.
 * {@code since} is the time the relationship reached its current state (or null).
 */
public record SocialUserDto(
        Long userId,
        String displayName,
        String photoUrl,
        String email,
        String relation,
        Instant since
) {
    public static SocialUserDto of(User u, String relation, Instant since) {
        return new SocialUserDto(u.getId(), u.getDisplayName(), u.getPhotoUrl(), u.getEmail(), relation, since);
    }
}
