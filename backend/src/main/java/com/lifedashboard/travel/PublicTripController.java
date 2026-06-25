package com.lifedashboard.travel;

import com.fasterxml.jackson.databind.JsonNode;
import com.lifedashboard.common.ApiResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/**
 * Public, unauthenticated read access to shared trips. Mounted under
 * {@code /api/public/**}, which {@link com.lifedashboard.config.SecurityConfig}
 * permits without a token. Anyone with a valid share token can read the
 * snapshot; nothing here exposes other users' data.
 */
@RestController
@RequestMapping("/api/public/trip")
@RequiredArgsConstructor
public class PublicTripController {

    private final SharedTripService sharedTripService;

    @GetMapping("/{token}")
    public ResponseEntity<ApiResponse<JsonNode>> get(@PathVariable String token) {
        JsonNode snapshot = sharedTripService.getByToken(token);
        if (snapshot == null) {
            return ResponseEntity.status(404).body(ApiResponse.error("trip not found"));
        }
        return ResponseEntity.ok(ApiResponse.ok(snapshot));
    }
}
