package com.lifedashboard.usage;

import com.lifedashboard.usage.dto.UsageDto;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.YearMonth;

@Service
@RequiredArgsConstructor
public class UsageService {

    // Cloud Run free tier: 2,000,000 requests per month.
    private static final long FREE_REQUEST_LIMIT = 2_000_000L;

    private final MonthlyUsageRepository usageRepository;

    @Transactional(readOnly = true)
    public UsageDto getCurrentMonthUsage() {
        String ym = YearMonth.now().toString();
        long requests = usageRepository.findByYearMonth(ym)
                .map(MonthlyUsage::getRequestCount)
                .orElse(0L);
        return new UsageDto(
                ym,
                requests,
                FREE_REQUEST_LIMIT,
                "Billing guard active: project billing auto-disables if monthly cost exceeds the budget."
        );
    }
}
