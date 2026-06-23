package com.lifedashboard.usage;

import com.lifedashboard.common.ApiResponse;
import com.lifedashboard.common.exception.ForbiddenException;
import com.lifedashboard.security.CurrentUserService;
import com.lifedashboard.usage.dto.UsageDto;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Owner-only free-tier usage summary. If {@code app.owner-email} is set, only
 * that user may read it; otherwise it is available to any authenticated user
 * (handy for local dev). The frontend hides the card on a 403.
 */
@RestController
@RequestMapping("/api/usage")
@RequiredArgsConstructor
public class UsageController {

    private final UsageService usageService;
    private final CurrentUserService currentUserService;

    @Value("${app.owner-email:}")
    private String ownerEmail;

    @GetMapping
    public ApiResponse<UsageDto> usage() {
        if (StringUtils.hasText(ownerEmail)) {
            String email = currentUserService.getCurrentUser().getEmail();
            if (!ownerEmail.equalsIgnoreCase(email)) {
                throw new ForbiddenException("Usage stats are visible to the app owner only");
            }
        }
        return ApiResponse.ok(usageService.getCurrentMonthUsage());
    }
}
