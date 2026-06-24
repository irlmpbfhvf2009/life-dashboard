package com.lifedashboard.user.dto;

import com.lifedashboard.user.User;
import com.lifedashboard.user.UserService;

import java.time.Instant;

public record UserDto(
        Long id,
        String firebaseUid,
        String email,
        String displayName,
        String photoUrl,
        boolean isPlayer,
        boolean isAdmin,
        Instant createdAt,
        Instant updatedAt
) {
    public static UserDto from(User u) {
        return new UserDto(
                u.getId(),
                u.getFirebaseUid(),
                u.getEmail(),
                u.getDisplayName(),
                u.getPhotoUrl(),
                UserService.isPlayer(u),
                UserService.isAdmin(u),
                u.getCreatedAt(),
                u.getUpdatedAt()
        );
    }
}
