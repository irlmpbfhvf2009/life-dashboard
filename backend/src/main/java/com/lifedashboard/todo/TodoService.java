package com.lifedashboard.todo;

import com.lifedashboard.common.exception.ResourceNotFoundException;
import com.lifedashboard.security.CurrentUserService;
import com.lifedashboard.todo.dto.CreateTodoRequest;
import com.lifedashboard.todo.dto.TodoDto;
import com.lifedashboard.todo.dto.UpdateTodoRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class TodoService {

    private final TodoRepository todoRepository;
    private final CurrentUserService currentUserService;

    @Transactional(readOnly = true)
    public List<TodoDto> list(TodoStatus status) {
        Long userId = currentUserService.getCurrentUserId();
        List<Todo> todos = (status == null)
                ? todoRepository.findByUserIdOrderByCreatedAtDesc(userId)
                : todoRepository.findByUserIdAndStatusOrderByCreatedAtDesc(userId, status);
        return todos.stream().map(TodoDto::from).toList();
    }

    @Transactional
    public TodoDto create(CreateTodoRequest request) {
        Long userId = currentUserService.getCurrentUserId();
        Todo todo = Todo.builder()
                .userId(userId)
                .title(request.title())
                .description(request.description())
                .status(TodoStatus.TODO)
                .priority(request.priority() != null ? request.priority() : TodoPriority.MEDIUM)
                .dueDate(request.dueDate())
                .build();
        return TodoDto.from(todoRepository.save(todo));
    }

    @Transactional
    public TodoDto update(Long id, UpdateTodoRequest request) {
        Todo todo = getOwned(id);
        if (request.title() != null) todo.setTitle(request.title());
        if (request.description() != null) todo.setDescription(request.description());
        if (request.status() != null) todo.setStatus(request.status());
        if (request.priority() != null) todo.setPriority(request.priority());
        if (request.dueDate() != null) todo.setDueDate(request.dueDate());
        return TodoDto.from(todoRepository.save(todo));
    }

    @Transactional
    public void delete(Long id) {
        Todo todo = getOwned(id);
        todoRepository.delete(todo);
    }

    private Todo getOwned(Long id) {
        Long userId = currentUserService.getCurrentUserId();
        return todoRepository.findByIdAndUserId(id, userId)
                .orElseThrow(() -> new ResourceNotFoundException("Todo not found: " + id));
    }
}
