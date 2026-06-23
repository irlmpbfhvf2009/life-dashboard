package com.lifedashboard.dashboard.dto;

import com.lifedashboard.food.dto.FoodDto;
import com.lifedashboard.mood.dto.MoodDto;
import com.lifedashboard.note.dto.NoteDto;
import com.lifedashboard.weight.dto.WeightDto;

import java.math.BigDecimal;
import java.util.List;

public record DashboardDto(
        long todayTodoCount,            // open todos due today
        long todayDoneCount,            // completed todos due today
        List<WeightDto> weekWeightTrend, // weight points for the last 7 days
        BigDecimal monthExpenseTotal,   // total spend for the current month
        List<FoodDto> recentFoods,      // latest 5 food records
        List<MoodDto> recentMoods,      // latest 5 mood records
        List<NoteDto> recentNotes       // latest 3 notes
) {
}
