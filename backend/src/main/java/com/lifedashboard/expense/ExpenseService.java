package com.lifedashboard.expense;

import com.lifedashboard.common.exception.ResourceNotFoundException;
import com.lifedashboard.expense.dto.CreateExpenseRequest;
import com.lifedashboard.expense.dto.ExpenseDto;
import com.lifedashboard.expense.dto.MonthlyStatsDto;
import com.lifedashboard.security.CurrentUserService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.format.DateTimeParseException;
import java.util.List;

@Service
@RequiredArgsConstructor
public class ExpenseService {

    private final ExpenseRepository expenseRepository;
    private final CurrentUserService currentUserService;

    @Transactional(readOnly = true)
    public List<ExpenseDto> list() {
        Long userId = currentUserService.getCurrentUserId();
        return expenseRepository.findByUserIdOrderByDateDescCreatedAtDesc(userId).stream()
                .map(ExpenseDto::from).toList();
    }

    @Transactional
    public ExpenseDto create(CreateExpenseRequest request) {
        Long userId = currentUserService.getCurrentUserId();
        Expense expense = Expense.builder()
                .userId(userId)
                .date(request.date())
                .amount(request.amount())
                .category(request.category())
                .description(request.description())
                .build();
        return ExpenseDto.from(expenseRepository.save(expense));
    }

    @Transactional
    public void delete(Long id) {
        Long userId = currentUserService.getCurrentUserId();
        Expense expense = expenseRepository.findByIdAndUserId(id, userId)
                .orElseThrow(() -> new ResourceNotFoundException("Expense not found: " + id));
        expenseRepository.delete(expense);
    }

    /**
     * Monthly stats. {@code month} is optional in "yyyy-MM" form; defaults to
     * the current month.
     */
    @Transactional(readOnly = true)
    public MonthlyStatsDto monthlyStats(String month) {
        Long userId = currentUserService.getCurrentUserId();
        YearMonth ym = parseMonth(month);
        LocalDate from = ym.atDay(1);
        LocalDate to = ym.atEndOfMonth();

        List<ExpenseRepository.CategoryTotal> rows = expenseRepository.sumByCategory(userId, from, to);

        BigDecimal total = rows.stream()
                .map(ExpenseRepository.CategoryTotal::getTotal)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        List<MonthlyStatsDto.CategoryBreakdown> breakdown = rows.stream()
                .map(r -> new MonthlyStatsDto.CategoryBreakdown(r.getCategory(), r.getTotal()))
                .toList();

        return new MonthlyStatsDto(ym.toString(), total, breakdown);
    }

    private YearMonth parseMonth(String month) {
        if (month == null || month.isBlank()) {
            return YearMonth.now();
        }
        try {
            return YearMonth.parse(month);
        } catch (DateTimeParseException ex) {
            throw new IllegalArgumentException("month must be in yyyy-MM format");
        }
    }
}
