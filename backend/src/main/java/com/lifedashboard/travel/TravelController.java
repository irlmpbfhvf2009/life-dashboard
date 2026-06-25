package com.lifedashboard.travel;

import com.fasterxml.jackson.databind.JsonNode;
import com.lifedashboard.common.ApiResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/travel")
@RequiredArgsConstructor
public class TravelController {

    private final TravelStateService stateService;

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
}
