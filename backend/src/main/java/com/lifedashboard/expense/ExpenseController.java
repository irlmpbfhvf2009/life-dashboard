package com.lifedashboard.expense;

import com.lifedashboard.common.ApiResponse;
import com.lifedashboard.expense.dto.CreateExpenseRequest;
import com.lifedashboard.expense.dto.ExpenseDto;
import com.lifedashboard.expense.dto.MonthlyStatsDto;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/expenses")
@RequiredArgsConstructor
public class ExpenseController {

    private final ExpenseService expenseService;

    @GetMapping
    public ApiResponse<List<ExpenseDto>> list() {
        return ApiResponse.ok(expenseService.list());
    }

    @GetMapping("/stats/monthly")
    public ApiResponse<MonthlyStatsDto> monthlyStats(@RequestParam(required = false) String month) {
        return ApiResponse.ok(expenseService.monthlyStats(month));
    }

    @PostMapping
    public ApiResponse<ExpenseDto> create(@Valid @RequestBody CreateExpenseRequest request) {
        return ApiResponse.ok(expenseService.create(request));
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable Long id) {
        expenseService.delete(id);
        return ApiResponse.ok();
    }
}
