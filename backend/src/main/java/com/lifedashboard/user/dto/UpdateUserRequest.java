package com.lifedashboard.user.dto;

import jakarta.validation.constraints.Size;

public record UpdateUserRequest(
        @Size(max = 255, message = "displayName must be at most 255 characters")
        String displayName,

        @Size(max = 1024, message = "photoUrl must be at most 1024 characters")
        String photoUrl
) {
}
