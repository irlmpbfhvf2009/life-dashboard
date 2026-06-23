package com.lifedashboard.security;

/**
 * Lightweight, immutable representation of the authenticated Firebase user.
 * Stored as the principal inside Spring Security's Authentication object.
 * This holds the claims taken straight from the verified Firebase ID token,
 * NOT the database User entity.
 */
public record FirebaseUserPrincipal(
        String uid,
        String email,
        String displayName,
        String photoUrl
) {
}
