package com.lifedashboard.admin.dto;

import java.time.Instant;

public record AdminUserDto(
        Long id,
        String email,
        String displayName,
        String photoUrl,
        long coins,
        boolean isPlayer,
        boolean isAdmin,
        Instant createdAt
) {
}
