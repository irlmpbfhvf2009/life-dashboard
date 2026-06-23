package com.lifedashboard.food;

import com.lifedashboard.common.ApiResponse;
import com.lifedashboard.food.dto.CreateFoodRequest;
import com.lifedashboard.food.dto.FoodDto;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/foods")
@RequiredArgsConstructor
public class FoodController {

    private final FoodService foodService;

    @GetMapping
    public ApiResponse<List<FoodDto>> list() {
        return ApiResponse.ok(foodService.list());
    }

    @PostMapping
    public ApiResponse<FoodDto> create(@Valid @RequestBody CreateFoodRequest request) {
        return ApiResponse.ok(foodService.create(request));
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable Long id) {
        foodService.delete(id);
        return ApiResponse.ok();
    }
}
