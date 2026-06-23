package com.lifedashboard.weight;

import com.lifedashboard.common.exception.ResourceNotFoundException;
import com.lifedashboard.security.CurrentUserService;
import com.lifedashboard.weight.dto.CreateWeightRequest;
import com.lifedashboard.weight.dto.WeightDto;
import com.lifedashboard.weight.dto.WeightStatsDto;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.List;

@Service
@RequiredArgsConstructor
public class WeightService {

    private final WeightRepository weightRepository;
    private final CurrentUserService currentUserService;

    @Transactional(readOnly = true)
    public List<WeightDto> list() {
        Long userId = currentUserService.getCurrentUserId();
        return weightRepository.findByUserIdOrderByDateDesc(userId).stream()
                .map(WeightDto::from).toList();
    }

    @Transactional(readOnly = true)
    public WeightDto latest() {
        Long userId = currentUserService.getCurrentUserId();
        return weightRepository.findFirstByUserIdOrderByDateDescIdDesc(userId)
                .map(WeightDto::from)
                .orElse(null);
    }

    @Transactional
    public WeightDto create(CreateWeightRequest request) {
        Long userId = currentUserService.getCurrentUserId();
        WeightRecord record = WeightRecord.builder()
                .userId(userId)
                .date(request.date())
                .weight(request.weight())
                .note(request.note())
                .build();
        return WeightDto.from(weightRepository.save(record));
    }

    @Transactional
    public void delete(Long id) {
        Long userId = currentUserService.getCurrentUserId();
        WeightRecord record = weightRepository.findByIdAndUserId(id, userId)
                .orElseThrow(() -> new ResourceNotFoundException("Weight record not found: " + id));
        weightRepository.delete(record);
    }

    @Transactional(readOnly = true)
    public WeightStatsDto stats(String range) {
        Long userId = currentUserService.getCurrentUserId();
        int days = parseRangeDays(range);
        LocalDate from = LocalDate.now().minusDays(days - 1L);

        List<WeightRecord> records =
                weightRepository.findByUserIdAndDateGreaterThanEqualOrderByDateAsc(userId, from);

        List<WeightDto> points = records.stream().map(WeightDto::from).toList();

        if (records.isEmpty()) {
            return new WeightStatsDto(range, 0, null, null, null, null, points);
        }

        BigDecimal min = records.stream().map(WeightRecord::getWeight)
                .min(BigDecimal::compareTo).orElse(null);
        BigDecimal max = records.stream().map(WeightRecord::getWeight)
                .max(BigDecimal::compareTo).orElse(null);
        BigDecimal sum = records.stream().map(WeightRecord::getWeight)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal avg = sum.divide(BigDecimal.valueOf(records.size()), 2, RoundingMode.HALF_UP);
        BigDecimal change = records.get(records.size() - 1).getWeight()
                .subtract(records.get(0).getWeight());

        return new WeightStatsDto(range, records.size(), min, max, avg, change, points);
    }

    private int parseRangeDays(String range) {
        if (range == null) return 7;
        return switch (range.toLowerCase()) {
            case "7d" -> 7;
            case "30d" -> 30;
            case "90d" -> 90;
            default -> throw new IllegalArgumentException("range must be one of: 7d, 30d, 90d");
        };
    }
}
