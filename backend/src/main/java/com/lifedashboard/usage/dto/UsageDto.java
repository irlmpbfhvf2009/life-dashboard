package com.lifedashboard.usage.dto;

public record UsageDto(
        String month,              // e.g. "2026-06"
        long requests,             // API requests served this month (app-tracked)
        long freeRequestLimit,     // Cloud Run free tier: 2,000,000 requests / month
        String budgetNote          // human-readable note about the billing guard
) {
}
