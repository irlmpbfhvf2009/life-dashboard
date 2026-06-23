package com.lifedashboard.common.exception;

/**
 * Thrown when a requested entity does not exist, or exists but does not belong
 * to the current user (we deliberately avoid leaking the difference).
 */
public class ResourceNotFoundException extends RuntimeException {
    public ResourceNotFoundException(String message) {
        super(message);
    }
}
