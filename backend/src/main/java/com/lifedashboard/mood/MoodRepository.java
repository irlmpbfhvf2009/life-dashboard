package com.lifedashboard.mood;

import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface MoodRepository extends JpaRepository<MoodRecord, Long> {

    List<MoodRecord> findByUserIdOrderByDateDescCreatedAtDesc(Long userId);

    List<MoodRecord> findTop5ByUserIdOrderByDateDescCreatedAtDesc(Long userId);

    Optional<MoodRecord> findByIdAndUserId(Long id, Long userId);

    List<MoodRecord> findByUserIdAndDateGreaterThanEqualOrderByDateAsc(Long userId, LocalDate from);
}
