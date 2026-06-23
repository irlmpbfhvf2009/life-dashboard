package com.lifedashboard.todo;

import com.lifedashboard.common.ApiResponse;
import com.lifedashboard.todo.dto.CreateTodoRequest;
import com.lifedashboard.todo.dto.TodoDto;
import com.lifedashboard.todo.dto.UpdateTodoRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/todos")
@RequiredArgsConstructor
public class TodoController {

    private final TodoService todoService;

    @GetMapping
    public ApiResponse<List<TodoDto>> list(@RequestParam(required = false) TodoStatus status) {
        return ApiResponse.ok(todoService.list(status));
    }

    @PostMapping
    public ApiResponse<TodoDto> create(@Valid @RequestBody CreateTodoRequest request) {
        return ApiResponse.ok(todoService.create(request));
    }

    @PatchMapping("/{id}")
    public ApiResponse<TodoDto> update(@PathVariable Long id,
                                       @Valid @RequestBody UpdateTodoRequest request) {
        return ApiResponse.ok(todoService.update(id, request));
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable Long id) {
        todoService.delete(id);
        return ApiResponse.ok();
    }
}
