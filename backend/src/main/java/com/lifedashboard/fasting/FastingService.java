package com.lifedashboard.fasting;

import com.lifedashboard.common.exception.ResourceNotFoundException;
import com.lifedashboard.fasting.dto.FastingSessionDto;
import com.lifedashboard.fasting.dto.FastingStatsDto;
import com.lifedashboard.security.CurrentUserService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class FastingService {

    /** Day bucketing for streaks uses Taiwan local time (the app's audience). */
    private static final ZoneId ZONE = ZoneId.of("Asia/Taipei");

    private final FastingRepository repository;
    private final CurrentUserService currentUserService;

    /** The in-progress fast, or null when none is active. */
    @Transactional(readOnly = true)
    public FastingSessionDto current() {
        Long userId = currentUserService.getCurrentUserId();
        return repository.findByUserIdAndEndAtIsNull(userId)
                .map(FastingSessionDto::from)
                .orElse(null);
    }

    @Transactional(readOnly = true)
    public List<FastingSessionDto> recent(int limit) {
        Long userId = currentUserService.getCurrentUserId();
        return repository.findByUserIdAndEndAtIsNotNullOrderByStartAtDesc(userId, PageRequest.of(0, Math.min(limit, 100)))
                .stream().map(FastingSessionDto::from).toList();
    }

    @Transactional
    public FastingSessionDto start(int targetHours) {
        Long userId = currentUserService.getCurrentUserId();
        repository.findByUserIdAndEndAtIsNull(userId).ifPresent(s -> {
            throw new IllegalArgumentException("已有進行中的斷食");
        });
        FastingSession session = FastingSession.builder()
                .userId(userId)
                .startAt(Instant.now())
                .targetHours(targetHours)
                .build();
        return FastingSessionDto.from(repository.save(session));
    }

    @Transactional
    public FastingSessionDto stop() {
        Long userId = currentUserService.getCurrentUserId();
        FastingSession session = repository.findByUserIdAndEndAtIsNull(userId)
                .orElseThrow(() -> new IllegalArgumentException("沒有進行中的斷食"));
        session.setEndAt(Instant.now());
        return FastingSessionDto.from(repository.save(session));
    }

    @Transactional
    public void delete(Long id) {
        Long userId = currentUserService.getCurrentUserId();
        FastingSession session = repository.findByIdAndUserId(id, userId)
                .orElseThrow(() -> new ResourceNotFoundException("Fasting session not found: " + id));
        repository.delete(session);
    }

    @Transactional(readOnly = true)
    public FastingStatsDto stats() {
        Long userId = currentUserService.getCurrentUserId();
        List<FastingSession> finished = repository.findByUserIdAndEndAtIsNotNull(userId);

        int total = finished.size();
        int completed = 0;
        long longest = 0;
        long sumMinutes = 0;
        int thisWeek = 0;
        Instant weekAgo = Instant.now().minus(Duration.ofDays(7));
        Set<LocalDate> completedDays = new HashSet<>();

        for (FastingSession s : finished) {
            long minutes = Math.max(0, Duration.between(s.getStartAt(), s.getEndAt()).toMinutes());
            sumMinutes += minutes;
            longest = Math.max(longest, minutes);
            if (s.getStartAt().isAfter(weekAgo)) thisWeek++;
            if (minutes >= (long) s.getTargetHours() * 60) {
                completed++;
                completedDays.add(s.getEndAt().atZone(ZONE).toLocalDate());
            }
        }

        long avg = total > 0 ? sumMinutes / total : 0;
        int streak = currentStreak(completedDays);
        return new FastingStatsDto(total, completed, streak, longest, avg, thisWeek);
    }

    /** Consecutive days (ending today, or yesterday) that have a completed fast. */
    private int currentStreak(Set<LocalDate> completedDays) {
        if (completedDays.isEmpty()) return 0;
        LocalDate today = LocalDate.now(ZONE);
        LocalDate cursor = completedDays.contains(today) ? today : today.minusDays(1);
        int streak = 0;
        while (completedDays.contains(cursor)) {
            streak++;
            cursor = cursor.minusDays(1);
        }
        return streak;
    }
}
