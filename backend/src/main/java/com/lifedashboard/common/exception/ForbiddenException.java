package com.lifedashboard.common.exception;

/**
 * Thrown when the authenticated user is not allowed to access a resource
 * (e.g. owner-only endpoints).
 */
public class ForbiddenException extends RuntimeException {
    public ForbiddenException(String message) {
        super(message);
    }
}
