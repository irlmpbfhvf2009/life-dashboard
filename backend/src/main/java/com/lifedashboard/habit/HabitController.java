package com.lifedashboard.habit;

import com.lifedashboard.common.ApiResponse;
import com.lifedashboard.habit.dto.CreateHabitRequest;
import com.lifedashboard.habit.dto.HabitDto;
import com.lifedashboard.habit.dto.UpdateHabitRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/habits")
@RequiredArgsConstructor
public class HabitController {

    private final HabitService habitService;

    @GetMapping
    public ApiResponse<List<HabitDto>> list() {
        return ApiResponse.ok(habitService.list());
    }

    @PostMapping
    public ApiResponse<HabitDto> create(@Valid @RequestBody CreateHabitRequest request) {
        return ApiResponse.ok(habitService.create(request));
    }

    @PatchMapping("/{id}")
    public ApiResponse<HabitDto> update(@PathVariable Long id,
                                        @Valid @RequestBody UpdateHabitRequest request) {
        return ApiResponse.ok(habitService.update(id, request));
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable Long id) {
        habitService.delete(id);
        return ApiResponse.ok();
    }

    @PostMapping("/{id}/check")
    public ApiResponse<HabitDto> check(@PathVariable Long id) {
        return ApiResponse.ok(habitService.check(id));
    }

    @PostMapping("/{id}/uncheck")
    public ApiResponse<HabitDto> uncheck(@PathVariable Long id) {
        return ApiResponse.ok(habitService.uncheck(id));
    }
}
