package com.lifedashboard.common.exception;

/**
 * Thrown when a dependency needed to serve the request is not configured or is
 * temporarily unavailable (e.g. the AI provider key is missing, or the upstream
 * API failed). Surfaces as HTTP 503 with a friendly message.
 */
public class ServiceUnavailableException extends RuntimeException {
    public ServiceUnavailableException(String message) {
        super(message);
    }
}
