package com.lifedashboard.usage;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

import java.util.Optional;

public interface MonthlyUsageRepository extends JpaRepository<MonthlyUsage, String> {

    Optional<MonthlyUsage> findByYearMonth(String yearMonth);

    /**
     * Atomic upsert-and-increment for the given month (PostgreSQL).
     * One small write per API request; never blocks the request on failure.
     */
    @Modifying
    @Transactional
    @Query(value = """
            INSERT INTO monthly_usage (year_month, request_count)
            VALUES (:ym, 1)
            ON CONFLICT (year_month)
            DO UPDATE SET request_count = monthly_usage.request_count + 1
            """, nativeQuery = true)
    void increment(@Param("ym") String yearMonth);
}
