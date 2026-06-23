package com.lifedashboard.food;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface FoodRepository extends JpaRepository<FoodRecord, Long> {

    List<FoodRecord> findByUserIdOrderByDateDescCreatedAtDesc(Long userId);

    List<FoodRecord> findTop5ByUserIdOrderByDateDescCreatedAtDesc(Long userId);

    Optional<FoodRecord> findByIdAndUserId(Long id, Long userId);
}
