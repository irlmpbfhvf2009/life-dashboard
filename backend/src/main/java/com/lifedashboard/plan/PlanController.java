package com.lifedashboard.plan;

import com.fasterxml.jackson.databind.JsonNode;
import com.lifedashboard.common.ApiResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/plan")
@RequiredArgsConstructor
public class PlanController {

    private final PlanStateService stateService;

    /** The current user's training/diet plan (null if they have none yet). */
    @GetMapping("/state")
    public ApiResponse<JsonNode> getState() {
        return ApiResponse.ok(stateService.get());
    }

    /** Persist the current user's training/diet plan. */
    @PutMapping("/state")
    public ApiResponse<Void> putState(@RequestBody JsonNode body) {
        stateService.save(body);
        return ApiResponse.ok();
    }
}
