package com.lifedashboard.weight;

import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface WeightRepository extends JpaRepository<WeightRecord, Long> {

    List<WeightRecord> findByUserIdOrderByDateDesc(Long userId);

    Optional<WeightRecord> findFirstByUserIdOrderByDateDescIdDesc(Long userId);

    Optional<WeightRecord> findByIdAndUserId(Long id, Long userId);

    List<WeightRecord> findByUserIdAndDateGreaterThanEqualOrderByDateAsc(Long userId, LocalDate from);
}
