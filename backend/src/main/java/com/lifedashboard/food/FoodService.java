package com.lifedashboard.food;

import com.lifedashboard.common.exception.ResourceNotFoundException;
import com.lifedashboard.food.dto.CreateFoodRequest;
import com.lifedashboard.food.dto.FoodDto;
import com.lifedashboard.security.CurrentUserService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class FoodService {

    private final FoodRepository foodRepository;
    private final CurrentUserService currentUserService;

    @Transactional(readOnly = true)
    public List<FoodDto> list() {
        Long userId = currentUserService.getCurrentUserId();
        return foodRepository.findByUserIdOrderByDateDescCreatedAtDesc(userId).stream()
                .map(FoodDto::from).toList();
    }

    @Transactional
    public FoodDto create(CreateFoodRequest request) {
        Long userId = currentUserService.getCurrentUserId();
        FoodRecord record = FoodRecord.builder()
                .userId(userId)
                .date(request.date())
                .mealType(request.mealType())
                .foodText(request.foodText())
                .note(request.note())
                .build();
        return FoodDto.from(foodRepository.save(record));
    }

    @Transactional
    public void delete(Long id) {
        Long userId = currentUserService.getCurrentUserId();
        FoodRecord record = foodRepository.findByIdAndUserId(id, userId)
                .orElseThrow(() -> new ResourceNotFoundException("Food record not found: " + id));
        foodRepository.delete(record);
    }
}
