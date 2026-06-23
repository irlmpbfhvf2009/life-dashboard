package com.lifedashboard.todo;

import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface TodoRepository extends JpaRepository<Todo, Long> {

    List<Todo> findByUserIdOrderByCreatedAtDesc(Long userId);

    List<Todo> findByUserIdAndStatusOrderByCreatedAtDesc(Long userId, TodoStatus status);

    Optional<Todo> findByIdAndUserId(Long id, Long userId);

    long countByUserIdAndDueDate(Long userId, LocalDate dueDate);

    long countByUserIdAndStatusAndDueDate(Long userId, TodoStatus status, LocalDate dueDate);

    long countByUserIdAndStatus(Long userId, TodoStatus status);
}
