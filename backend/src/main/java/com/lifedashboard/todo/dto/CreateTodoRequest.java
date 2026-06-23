package com.lifedashboard.todo.dto;

import com.lifedashboard.todo.TodoPriority;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;

public record CreateTodoRequest(
        @NotBlank(message = "title is required")
        @Size(max = 255)
        String title,

        @Size(max = 5000)
        String description,

        TodoPriority priority,

        LocalDate dueDate
) {
}
