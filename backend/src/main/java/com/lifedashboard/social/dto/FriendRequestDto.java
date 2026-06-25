package com.lifedashboard.social.dto;

import java.time.Instant;

/** A pending friend invite: the friendship row id + the other party. */
public record FriendRequestDto(
        Long requestId,
        SocialUserDto user,
        Instant createdAt
) {}
