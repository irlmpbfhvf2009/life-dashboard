package com.lifedashboard.common;

import com.fasterxml.jackson.annotation.JsonInclude;

/**
 * Unified envelope for every API response.
 *
 * Success: { "success": true,  "data": {...}, "message": null }
 * Error:   { "success": false, "data": null,  "message": "error message" }
 */
@JsonInclude(JsonInclude.Include.ALWAYS)
public record ApiResponse<T>(boolean success, T data, String message) {

    public static <T> ApiResponse<T> ok(T data) {
        return new ApiResponse<>(true, data, null);
    }

    public static <T> ApiResponse<T> ok() {
        return new ApiResponse<>(true, null, null);
    }

    public static <T> ApiResponse<T> error(String message) {
        return new ApiResponse<>(false, null, message);
    }
}
