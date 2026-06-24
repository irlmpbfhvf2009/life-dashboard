package com.lifedashboard.expense;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface ExpenseRepository extends JpaRepository<Expense, Long> {

    List<Expense> findByUserIdOrderByDateDescCreatedAtDesc(Long userId);

    Optional<Expense> findByIdAndUserId(Long id, Long userId);

    List<Expense> findByUserIdAndDateBetweenOrderByDateDesc(Long userId, LocalDate from, LocalDate to);

    /**
     * Total spend grouped by category within a date range (inclusive).
     * Only EXPENSE rows count — income is excluded so this stays a spending figure.
     * Returns rows of [category, total].
     */
    @Query("""
            select e.category as category, sum(e.amount) as total
            from Expense e
            where e.userId = :userId and e.date between :from and :to and e.type = 'EXPENSE'
            group by e.category
            order by sum(e.amount) desc
            """)
    List<CategoryTotal> sumByCategory(@Param("userId") Long userId,
                                      @Param("from") LocalDate from,
                                      @Param("to") LocalDate to);

    interface CategoryTotal {
        String getCategory();
        java.math.BigDecimal getTotal();
    }
}
