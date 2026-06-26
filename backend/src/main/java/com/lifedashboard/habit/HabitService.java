package com.lifedashboard.habit;

import com.lifedashboard.common.exception.ResourceNotFoundException;
import com.lifedashboard.habit.dto.CreateHabitRequest;
import com.lifedashboard.habit.dto.DayStatus;
import com.lifedashboard.habit.dto.HabitDto;
import com.lifedashboard.habit.dto.UpdateHabitRequest;
import com.lifedashboard.security.CurrentUserService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class HabitService {

    /** How many days back to load when computing streaks / recent view. */
    private static final int LOOKBACK_DAYS = 60;
    private static final int RECENT_DAYS = 7;

    private final HabitRepository habitRepository;
    private final HabitRecordRepository recordRepository;
    private final CurrentUserService currentUserService;

    @Transactional(readOnly = true)
    public List<HabitDto> list() {
        Long userId = currentUserService.getCurrentUserId();
        LocalDate today = LocalDate.now();
        List<Habit> habits = habitRepository.findByUserIdAndArchivedFalseOrderBySortOrderAscIdAsc(userId);

        // Load all recent records once, grouped by habit → date → count (avoids N+1).
        Map<Long, Map<LocalDate, Integer>> byHabit = new HashMap<>();
        for (HabitRecord r : recordRepository.findByUserIdAndDateGreaterThanEqual(userId, today.minusDays(LOOKBACK_DAYS))) {
            byHabit.computeIfAbsent(r.getHabitId(), k -> new HashMap<>()).put(r.getDate(), r.getCount());
        }

        return habits.stream().map(h -> toDto(h, byHabit.getOrDefault(h.getId(), Map.of()), today)).toList();
    }

    @Transactional
    public HabitDto create(CreateHabitRequest request) {
        Long userId = currentUserService.getCurrentUserId();
        int target = (request.targetPerDay() != null && request.targetPerDay() > 0) ? request.targetPerDay() : 1;
        Habit habit = Habit.builder()
                .userId(userId)
                .name(request.name())
                .emoji(request.emoji())
                .color(request.color())
                .targetPerDay(target)
                .sortOrder(0)
                .archived(false)
                .build();
        habit = habitRepository.save(habit);
        return toDto(habit, Map.of(), LocalDate.now());
    }

    @Transactional
    public HabitDto update(Long id, UpdateHabitRequest request) {
        Habit habit = getOwned(id);
        if (request.name() != null) habit.setName(request.name());
        if (request.emoji() != null) habit.setEmoji(request.emoji());
        if (request.color() != null) habit.setColor(request.color());
        if (request.targetPerDay() != null && request.targetPerDay() > 0) habit.setTargetPerDay(request.targetPerDay());
        if (request.archived() != null) habit.setArchived(request.archived());
        habitRepository.save(habit);
        return loadDto(habit);
    }

    @Transactional
    public void delete(Long id) {
        Habit habit = getOwned(id);
        recordRepository.deleteByHabitId(habit.getId());
        habitRepository.delete(habit);
    }

    /** Increment today's count by one (capped at the daily target). */
    @Transactional
    public HabitDto check(Long id) {
        Habit habit = getOwned(id);
        LocalDate today = LocalDate.now();
        HabitRecord record = recordRepository.findByHabitIdAndDate(habit.getId(), today)
                .orElseGet(() -> HabitRecord.builder()
                        .habitId(habit.getId())
                        .userId(habit.getUserId())
                        .date(today)
                        .count(0)
                        .build());
        record.setCount(Math.min(habit.getTargetPerDay(), record.getCount() + 1));
        recordRepository.save(record);
        return loadDto(habit);
    }

    /** Clear today's check-in entirely. */
    @Transactional
    public HabitDto uncheck(Long id) {
        Habit habit = getOwned(id);
        recordRepository.findByHabitIdAndDate(habit.getId(), LocalDate.now())
                .ifPresent(recordRepository::delete);
        return loadDto(habit);
    }

    private Habit getOwned(Long id) {
        Long userId = currentUserService.getCurrentUserId();
        return habitRepository.findByIdAndUserId(id, userId)
                .orElseThrow(() -> new ResourceNotFoundException("Habit not found: " + id));
    }

    /** Reload this habit's recent records and build a fresh DTO. */
    private HabitDto loadDto(Habit habit) {
        LocalDate today = LocalDate.now();
        Map<LocalDate, Integer> counts = new HashMap<>();
        for (HabitRecord r : recordRepository.findByUserIdAndDateGreaterThanEqual(habit.getUserId(), today.minusDays(LOOKBACK_DAYS))) {
            if (r.getHabitId().equals(habit.getId())) counts.put(r.getDate(), r.getCount());
        }
        return toDto(habit, counts, today);
    }

    private HabitDto toDto(Habit habit, Map<LocalDate, Integer> counts, LocalDate today) {
        int target = Math.max(1, habit.getTargetPerDay());
        int todayCount = counts.getOrDefault(today, 0);
        boolean doneToday = todayCount >= target;

        // Streak: consecutive done-days ending today (or yesterday if today not yet done).
        int streak = 0;
        LocalDate cursor = doneToday ? today : today.minusDays(1);
        while (counts.getOrDefault(cursor, 0) >= target) {
            streak++;
            cursor = cursor.minusDays(1);
        }

        // Recent days, oldest → newest.
        List<DayStatus> recent = new ArrayList<>();
        for (int i = RECENT_DAYS - 1; i >= 0; i--) {
            LocalDate d = today.minusDays(i);
            int c = counts.getOrDefault(d, 0);
            recent.add(new DayStatus(d, c, c >= target));
        }

        return new HabitDto(habit.getId(), habit.getName(), habit.getEmoji(), habit.getColor(),
                target, todayCount, doneToday, streak, recent, habit.getCreatedAt());
    }
}
