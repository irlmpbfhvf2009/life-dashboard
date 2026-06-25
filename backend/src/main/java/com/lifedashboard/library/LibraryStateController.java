package com.lifedashboard.library;

import com.fasterxml.jackson.databind.JsonNode;
import com.lifedashboard.common.ApiResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

/** Per-user library state: bookmarks + reading progress, synced across devices. */
@RestController
@RequestMapping("/api/library")
@RequiredArgsConstructor
public class LibraryStateController {

    private final LibraryStateService stateService;

    @GetMapping("/state")
    public ApiResponse<JsonNode> getState() {
        return ApiResponse.ok(stateService.get());
    }

    @PutMapping("/state")
    public ApiResponse<Void> putState(@RequestBody JsonNode body) {
        stateService.save(body);
        return ApiResponse.ok();
    }
}
