package com.lifedashboard.goal;

import com.lifedashboard.common.ApiResponse;
import com.lifedashboard.goal.dto.CreateGoalRequest;
import com.lifedashboard.goal.dto.GoalDto;
import com.lifedashboard.goal.dto.ProgressRequest;
import com.lifedashboard.goal.dto.UpdateGoalRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/goals")
@RequiredArgsConstructor
public class GoalController {

    private final GoalService goalService;

    @GetMapping
    public ApiResponse<List<GoalDto>> list() {
        return ApiResponse.ok(goalService.list());
    }

    @PostMapping
    public ApiResponse<GoalDto> create(@Valid @RequestBody CreateGoalRequest request) {
        return ApiResponse.ok(goalService.create(request));
    }

    @PatchMapping("/{id}")
    public ApiResponse<GoalDto> update(@PathVariable Long id,
                                       @Valid @RequestBody UpdateGoalRequest request) {
        return ApiResponse.ok(goalService.update(id, request));
    }

    @PostMapping("/{id}/progress")
    public ApiResponse<GoalDto> addProgress(@PathVariable Long id, @RequestBody ProgressRequest request) {
        return ApiResponse.ok(goalService.addProgress(id, request.delta()));
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable Long id) {
        goalService.delete(id);
        return ApiResponse.ok();
    }
}
