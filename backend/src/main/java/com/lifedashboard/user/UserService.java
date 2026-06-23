package com.lifedashboard.user;

import com.lifedashboard.security.FirebaseUserPrincipal;
import com.lifedashboard.user.dto.UpdateUserRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

@Service
@RequiredArgsConstructor
public class UserService {

    private final UserRepository userRepository;

    /**
     * Resolves the database user for the given Firebase principal, creating the
     * record on first login and refreshing profile fields that changed in
     * Firebase (e.g. the user updated their Google photo/name).
     */
    @Transactional
    public User provisionFromFirebase(FirebaseUserPrincipal principal) {
        return userRepository.findByFirebaseUid(principal.uid())
                .map(existing -> syncProfile(existing, principal))
                .orElseGet(() -> userRepository.save(User.builder()
                        .firebaseUid(principal.uid())
                        .email(principal.email() != null ? principal.email() : "")
                        .displayName(principal.displayName())
                        .photoUrl(principal.photoUrl())
                        .build()));
    }

    private User syncProfile(User user, FirebaseUserPrincipal principal) {
        boolean dirty = false;
        if (principal.email() != null && !principal.email().equals(user.getEmail())) {
            user.setEmail(principal.email());
            dirty = true;
        }
        // Only backfill display name / photo from Firebase if the user has not
        // set their own values yet, so manual edits via PATCH /api/me stick.
        if (!StringUtils.hasText(user.getDisplayName()) && StringUtils.hasText(principal.displayName())) {
            user.setDisplayName(principal.displayName());
            dirty = true;
        }
        if (!StringUtils.hasText(user.getPhotoUrl()) && StringUtils.hasText(principal.photoUrl())) {
            user.setPhotoUrl(principal.photoUrl());
            dirty = true;
        }
        return dirty ? userRepository.save(user) : user;
    }

    @Transactional
    public User updateProfile(User user, UpdateUserRequest request) {
        if (request.displayName() != null) {
            user.setDisplayName(request.displayName());
        }
        if (request.photoUrl() != null) {
            user.setPhotoUrl(request.photoUrl());
        }
        return userRepository.save(user);
    }
}
