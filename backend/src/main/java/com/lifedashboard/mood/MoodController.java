package com.lifedashboard.mood;

import com.lifedashboard.common.ApiResponse;
import com.lifedashboard.mood.dto.CreateMoodRequest;
import com.lifedashboard.mood.dto.MoodDto;
import com.lifedashboard.mood.dto.MoodStatsDto;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/moods")
@RequiredArgsConstructor
public class MoodController {

    private final MoodService moodService;

    @GetMapping
    public ApiResponse<List<MoodDto>> list() {
        return ApiResponse.ok(moodService.list());
    }

    @GetMapping("/stats")
    public ApiResponse<MoodStatsDto> stats(@RequestParam(defaultValue = "30") int days) {
        return ApiResponse.ok(moodService.stats(days));
    }

    @PostMapping
    public ApiResponse<MoodDto> create(@Valid @RequestBody CreateMoodRequest request) {
        return ApiResponse.ok(moodService.create(request));
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable Long id) {
        moodService.delete(id);
        return ApiResponse.ok();
    }
}
