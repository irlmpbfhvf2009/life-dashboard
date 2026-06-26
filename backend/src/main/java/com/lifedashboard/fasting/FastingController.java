package com.lifedashboard.fasting;

import com.lifedashboard.common.ApiResponse;
import com.lifedashboard.fasting.dto.FastingSessionDto;
import com.lifedashboard.fasting.dto.FastingStatsDto;
import com.lifedashboard.fasting.dto.StartFastingRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/fasting")
@RequiredArgsConstructor
public class FastingController {

    private final FastingService fastingService;

    @GetMapping("/current")
    public ApiResponse<FastingSessionDto> current() {
        return ApiResponse.ok(fastingService.current());
    }

    @GetMapping("/sessions")
    public ApiResponse<List<FastingSessionDto>> recent(@RequestParam(defaultValue = "20") int limit) {
        return ApiResponse.ok(fastingService.recent(limit));
    }

    @GetMapping("/stats")
    public ApiResponse<FastingStatsDto> stats() {
        return ApiResponse.ok(fastingService.stats());
    }

    @PostMapping("/start")
    public ApiResponse<FastingSessionDto> start(@Valid @RequestBody StartFastingRequest request) {
        return ApiResponse.ok(fastingService.start(request.targetHours()));
    }

    @PostMapping("/stop")
    public ApiResponse<FastingSessionDto> stop() {
        return ApiResponse.ok(fastingService.stop());
    }

    @DeleteMapping("/sessions/{id}")
    public ApiResponse<Void> delete(@PathVariable Long id) {
        fastingService.delete(id);
        return ApiResponse.ok();
    }
}
