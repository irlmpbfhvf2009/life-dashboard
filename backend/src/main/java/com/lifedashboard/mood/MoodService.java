package com.lifedashboard.mood;

import com.lifedashboard.common.exception.ResourceNotFoundException;
import com.lifedashboard.mood.dto.CreateMoodRequest;
import com.lifedashboard.mood.dto.MoodDto;
import com.lifedashboard.mood.dto.MoodStatsDto;
import com.lifedashboard.security.CurrentUserService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class MoodService {

    private final MoodRepository moodRepository;
    private final CurrentUserService currentUserService;

    @Transactional(readOnly = true)
    public List<MoodDto> list() {
        Long userId = currentUserService.getCurrentUserId();
        return moodRepository.findByUserIdOrderByDateDescCreatedAtDesc(userId).stream()
                .map(MoodDto::from).toList();
    }

    @Transactional
    public MoodDto create(CreateMoodRequest request) {
        Long userId = currentUserService.getCurrentUserId();
        MoodRecord record = MoodRecord.builder()
                .userId(userId)
                .date(request.date())
                .moodScore(request.moodScore())
                .note(request.note())
                .build();
        return MoodDto.from(moodRepository.save(record));
    }

    @Transactional
    public void delete(Long id) {
        Long userId = currentUserService.getCurrentUserId();
        MoodRecord record = moodRepository.findByIdAndUserId(id, userId)
                .orElseThrow(() -> new ResourceNotFoundException("Mood record not found: " + id));
        moodRepository.delete(record);
    }

    @Transactional(readOnly = true)
    public MoodStatsDto stats(int days) {
        Long userId = currentUserService.getCurrentUserId();
        LocalDate from = LocalDate.now().minusDays(days - 1L);
        List<MoodRecord> records =
                moodRepository.findByUserIdAndDateGreaterThanEqualOrderByDateAsc(userId, from);

        Map<Integer, Long> distribution = new LinkedHashMap<>();
        for (int i = 1; i <= 5; i++) {
            distribution.put(i, 0L);
        }
        for (MoodRecord r : records) {
            distribution.merge(r.getMoodScore(), 1L, Long::sum);
        }

        Double average = records.isEmpty() ? null
                : records.stream().mapToInt(MoodRecord::getMoodScore).average().orElse(0);

        List<MoodDto> points = records.stream().map(MoodDto::from).toList();
        return new MoodStatsDto(records.size(), average, distribution, points);
    }
}
