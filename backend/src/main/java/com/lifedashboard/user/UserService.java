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

    /** The root super-admin — always has admin rights, can't be demoted. */
    public static final String ROOT_ADMIN_EMAIL = "ws794613@gmail.com";

    private final UserRepository userRepository;

    public static boolean isAdmin(User u) {
        return Boolean.TRUE.equals(u.getIsAdmin()) || ROOT_ADMIN_EMAIL.equalsIgnoreCase(u.getEmail());
    }

    public static boolean isPlayer(User u) {
        return Boolean.TRUE.equals(u.getIsPlayer()) || isAdmin(u);
    }

    public static boolean isStudio(User u) {
        return Boolean.TRUE.equals(u.getIsStudio()) || isAdmin(u);
    }

    /**
     * Give a brand-new user the default role for the portal they signed up on:
     * game portal → player, Studio → studio. Only applies when the user has no
     * roles yet, so it never overrides admin-assigned roles.
     */
    @Transactional
    public User applyDefaultRole(User user, String source) {
        boolean rolesEmpty = !Boolean.TRUE.equals(user.getIsPlayer())
                && !Boolean.TRUE.equals(user.getIsStudio());
        if (rolesEmpty) {
            if ("game".equalsIgnoreCase(source)) {
                user.setIsPlayer(true);
            } else {
                user.setIsStudio(true);
            }
            return userRepository.save(user);
        }
        return user;
    }

    /**
     * Resolves the database user for the given Firebase principal, creating the
     * record on first login and refreshing profile fields that changed in
     * Firebase (e.g. the user updated their Google photo/name).
     */
    @Transactional
    public User provisionFromFirebase(FirebaseUserPrincipal principal) {
        User user = userRepository.findByFirebaseUid(principal.uid())
                .map(existing -> syncProfile(existing, principal))
                .orElseGet(() -> userRepository.save(User.builder()
                        .firebaseUid(principal.uid())
                        .email(principal.email() != null ? principal.email() : "")
                        .displayName(principal.displayName())
                        .photoUrl(principal.photoUrl())
                        .build()));
        // Root admin always carries the admin flag.
        if (ROOT_ADMIN_EMAIL.equalsIgnoreCase(user.getEmail()) && !Boolean.TRUE.equals(user.getIsAdmin())) {
            user.setIsAdmin(true);
            user = userRepository.save(user);
        }
        return user;
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
