package com.lifedashboard.dashboard;

import com.lifedashboard.dashboard.dto.DashboardDto;
import com.lifedashboard.expense.ExpenseRepository;
import com.lifedashboard.food.FoodRepository;
import com.lifedashboard.food.dto.FoodDto;
import com.lifedashboard.mood.MoodRepository;
import com.lifedashboard.mood.dto.MoodDto;
import com.lifedashboard.note.NoteRepository;
import com.lifedashboard.note.dto.NoteDto;
import com.lifedashboard.security.CurrentUserService;
import com.lifedashboard.todo.TodoRepository;
import com.lifedashboard.todo.TodoStatus;
import com.lifedashboard.weight.WeightRepository;
import com.lifedashboard.weight.dto.WeightDto;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.List;

@Service
@RequiredArgsConstructor
public class DashboardService {

    private final CurrentUserService currentUserService;
    private final TodoRepository todoRepository;
    private final WeightRepository weightRepository;
    private final ExpenseRepository expenseRepository;
    private final FoodRepository foodRepository;
    private final MoodRepository moodRepository;
    private final NoteRepository noteRepository;

    @Transactional(readOnly = true)
    public DashboardDto getDashboard() {
        Long userId = currentUserService.getCurrentUserId();
        LocalDate today = LocalDate.now();

        long todayTodoCount = todoRepository.countByUserIdAndStatusAndDueDate(userId, TodoStatus.TODO, today);
        long todayDoneCount = todoRepository.countByUserIdAndStatusAndDueDate(userId, TodoStatus.DONE, today);

        List<WeightDto> weekWeightTrend = weightRepository
                .findByUserIdAndDateGreaterThanEqualOrderByDateAsc(userId, today.minusDays(6))
                .stream().map(WeightDto::from).toList();

        YearMonth month = YearMonth.now();
        BigDecimal monthExpenseTotal = expenseRepository
                .sumByCategory(userId, month.atDay(1), month.atEndOfMonth())
                .stream()
                .map(ExpenseRepository.CategoryTotal::getTotal)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        List<FoodDto> recentFoods = foodRepository
                .findTop5ByUserIdOrderByDateDescCreatedAtDesc(userId)
                .stream().map(FoodDto::from).toList();

        List<MoodDto> recentMoods = moodRepository
                .findTop5ByUserIdOrderByDateDescCreatedAtDesc(userId)
                .stream().map(MoodDto::from).toList();

        List<NoteDto> recentNotes = noteRepository
                .findTop3ByUserIdOrderByUpdatedAtDesc(userId)
                .stream().map(NoteDto::from).toList();

        return new DashboardDto(
                todayTodoCount,
                todayDoneCount,
                weekWeightTrend,
                monthExpenseTotal,
                recentFoods,
                recentMoods,
                recentNotes
        );
    }
}
