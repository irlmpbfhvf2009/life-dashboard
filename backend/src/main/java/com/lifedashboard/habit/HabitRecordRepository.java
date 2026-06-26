package com.lifedashboard.habit;

import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface HabitRecordRepository extends JpaRepository<HabitRecord, Long> {

    List<HabitRecord> findByUserIdAndDateGreaterThanEqual(Long userId, LocalDate from);

    Optional<HabitRecord> findByHabitIdAndDate(Long habitId, LocalDate date);

    void deleteByHabitId(Long habitId);
}
