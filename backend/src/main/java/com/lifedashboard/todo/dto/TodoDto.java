package com.lifedashboard.todo.dto;

import com.lifedashboard.todo.Todo;
import com.lifedashboard.todo.TodoPriority;
import com.lifedashboard.todo.TodoStatus;

import java.time.Instant;
import java.time.LocalDate;

public record TodoDto(
        Long id,
        String title,
        String description,
        TodoStatus status,
        TodoPriority priority,
        LocalDate dueDate,
        Instant createdAt,
        Instant updatedAt
) {
    public static TodoDto from(Todo t) {
        return new TodoDto(t.getId(), t.getTitle(), t.getDescription(), t.getStatus(),
                t.getPriority(), t.getDueDate(), t.getCreatedAt(), t.getUpdatedAt());
    }
}
