package com.lifedashboard.common.exception;

/**
 * Thrown when there is no authenticated user in the security context but one
 * is required (should normally be prevented by the security chain).
 */
public class UnauthorizedException extends RuntimeException {
    public UnauthorizedException(String message) {
        super(message);
    }
}
