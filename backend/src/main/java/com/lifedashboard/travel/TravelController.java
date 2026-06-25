package com.lifedashboard.travel;

import com.fasterxml.jackson.databind.JsonNode;
import com.lifedashboard.common.ApiResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/travel")
@RequiredArgsConstructor
public class TravelController {

    private final TravelStateService stateService;
    private final SharedTripService sharedTripService;

    /** The current user's travel state (null if they have none yet). */
    @GetMapping("/state")
    public ApiResponse<JsonNode> getState() {
        return ApiResponse.ok(stateService.get());
    }

    /** Persist the current user's travel state (trip expenses + rate). */
    @PutMapping("/state")
    public ApiResponse<Void> putState(@RequestBody JsonNode body) {
        stateService.save(body);
        return ApiResponse.ok();
    }

    /** Publish a read-only snapshot of the current trip; returns its public token. */
    @PostMapping("/share")
    public ApiResponse<Map<String, String>> share(@RequestBody JsonNode snapshot) {
        String token = sharedTripService.share(snapshot);
        return ApiResponse.ok(Map.of("token", token));
    }

    /** The current user's published share links. */
    @GetMapping("/shares")
    public ApiResponse<List<SharedTripSummary>> shares() {
        return ApiResponse.ok(sharedTripService.listMine());
    }

    /** Revoke one of the current user's share links. */
    @DeleteMapping("/share/{token}")
    public ApiResponse<Void> revoke(@PathVariable String token) {
        sharedTripService.revoke(token);
        return ApiResponse.ok();
    }
}
