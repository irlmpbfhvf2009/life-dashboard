package com.lifedashboard.social.dto;

import com.lifedashboard.food.dto.FoodDto;
import com.lifedashboard.mood.dto.MoodDto;
import com.lifedashboard.weight.dto.WeightDto;

import java.time.Instant;
import java.util.List;

/**
 * A friend's profile as exposed to the viewer. Basic identity is always present;
 * each data section is non-null only when the owner has opted to share it
 * (see {@link Visibility}). Sections mirror the modules the owner can toggle.
 */
public record FriendProfileDto(
        Long userId,
        String displayName,
        String photoUrl,
        String email,
        Instant joinedAt,
        Visibility visibility,
        Health health,
        Mood mood,
        Life life
) {
    public record Visibility(boolean health, boolean mood, boolean life) {}

    public record Health(
            List<WeightDto> weightTrend,
            WeightDto latestWeight,
            List<FoodDto> recentFoods
    ) {}

    public record Mood(
            List<MoodDto> recent,
            Double average
    ) {}

    public record Life(
            long openTodos,
            long todayTodos,
            long todayDone
    ) {}
}
