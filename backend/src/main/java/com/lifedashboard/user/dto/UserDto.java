package com.lifedashboard.user.dto;

import com.lifedashboard.user.User;

import java.time.Instant;

public record UserDto(
        Long id,
        String firebaseUid,
        String email,
        String displayName,
        String photoUrl,
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
                u.getCreatedAt(),
                u.getUpdatedAt()
        );
    }
}
