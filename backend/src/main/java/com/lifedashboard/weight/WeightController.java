package com.lifedashboard.weight;

import com.lifedashboard.common.ApiResponse;
import com.lifedashboard.weight.dto.CreateWeightRequest;
import com.lifedashboard.weight.dto.WeightDto;
import com.lifedashboard.weight.dto.WeightStatsDto;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/weights")
@RequiredArgsConstructor
public class WeightController {

    private final WeightService weightService;

    @GetMapping
    public ApiResponse<List<WeightDto>> list() {
        return ApiResponse.ok(weightService.list());
    }

    @GetMapping("/latest")
    public ApiResponse<WeightDto> latest() {
        return ApiResponse.ok(weightService.latest());
    }

    @GetMapping("/stats")
    public ApiResponse<WeightStatsDto> stats(@RequestParam(defaultValue = "7d") String range) {
        return ApiResponse.ok(weightService.stats(range));
    }

    @PostMapping
    public ApiResponse<WeightDto> create(@Valid @RequestBody CreateWeightRequest request) {
        return ApiResponse.ok(weightService.create(request));
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable Long id) {
        weightService.delete(id);
        return ApiResponse.ok();
    }
}
