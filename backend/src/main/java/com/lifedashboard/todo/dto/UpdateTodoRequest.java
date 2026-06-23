package com.lifedashboard.todo.dto;

import com.lifedashboard.todo.TodoPriority;
import com.lifedashboard.todo.TodoStatus;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;

/**
 * All fields optional — only non-null fields are applied (partial update).
 */
public record UpdateTodoRequest(
        @Size(max = 255)
        String title,

        @Size(max = 5000)
        String description,

        TodoStatus status,

        TodoPriority priority,

        LocalDate dueDate
) {
}
