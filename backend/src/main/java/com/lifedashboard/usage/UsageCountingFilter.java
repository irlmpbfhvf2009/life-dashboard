package com.lifedashboard.usage;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.annotation.Order;
import org.springframework.lang.NonNull;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.time.YearMonth;

/**
 * Counts API requests per month (best-effort) for the free-tier usage bar.
 * A counter failure must never affect the actual request, so all errors are
 * swallowed and logged at debug level.
 */
@Slf4j
@Component
@Order(1)
@RequiredArgsConstructor
public class UsageCountingFilter extends OncePerRequestFilter {

    private final MonthlyUsageRepository usageRepository;

    @Override
    protected void doFilterInternal(@NonNull HttpServletRequest request,
                                    @NonNull HttpServletResponse response,
                                    @NonNull FilterChain filterChain)
            throws ServletException, IOException {
        String path = request.getRequestURI();
        // Count real API traffic; don't count the usage endpoint itself.
        if (path != null && path.startsWith("/api/") && !path.startsWith("/api/usage")) {
            try {
                usageRepository.increment(YearMonth.now().toString());
            } catch (Exception ex) {
                log.debug("Usage counter increment failed: {}", ex.getMessage());
            }
        }
        filterChain.doFilter(request, response);
    }
}
