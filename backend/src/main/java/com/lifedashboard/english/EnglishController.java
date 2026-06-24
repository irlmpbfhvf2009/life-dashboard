package com.lifedashboard.english;

import com.fasterxml.jackson.databind.JsonNode;
import com.lifedashboard.common.ApiResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/english")
@RequiredArgsConstructor
public class EnglishController {

    private final EnglishStateService stateService;

    /** The current user's learning state (null if they have none yet). */
    @GetMapping("/state")
    public ApiResponse<JsonNode> getState() {
        return ApiResponse.ok(stateService.get());
    }

    /** Persist the current user's learning state. */
    @PutMapping("/state")
    public ApiResponse<Void> putState(@RequestBody JsonNode body) {
        stateService.save(body);
        return ApiResponse.ok();
    }
}
