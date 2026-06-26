package com.lifedashboard.goal;

import com.lifedashboard.common.exception.ResourceNotFoundException;
import com.lifedashboard.goal.dto.CreateGoalRequest;
import com.lifedashboard.goal.dto.GoalDto;
import com.lifedashboard.goal.dto.UpdateGoalRequest;
import com.lifedashboard.security.CurrentUserService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class GoalService {

    private final GoalRepository goalRepository;
    private final CurrentUserService currentUserService;

    @Transactional(readOnly = true)
    public List<GoalDto> list() {
        Long userId = currentUserService.getCurrentUserId();
        return goalRepository.findByUserIdAndStatusNotOrderBySortOrderAscIdAsc(userId, GoalStatus.ARCHIVED)
                .stream().map(GoalDto::from).toList();
    }

    @Transactional
    public GoalDto create(CreateGoalRequest request) {
        Long userId = currentUserService.getCurrentUserId();
        Goal goal = Goal.builder()
                .userId(userId)
                .title(request.title())
                .description(request.description())
                .targetValue(request.targetValue())
                .currentValue(0)
                .unit(request.unit())
                .deadline(request.deadline())
                .status(GoalStatus.ACTIVE)
                .color(request.color())
                .sortOrder(0)
                .build();
        return GoalDto.from(goalRepository.save(goal));
    }

    @Transactional
    public GoalDto update(Long id, UpdateGoalRequest request) {
        Goal goal = getOwned(id);
        if (request.title() != null) goal.setTitle(request.title());
        if (request.description() != null) goal.setDescription(request.description());
        if (request.targetValue() != null && request.targetValue() > 0) goal.setTargetValue(request.targetValue());
        if (request.currentValue() != null) goal.setCurrentValue(clamp(request.currentValue(), goal.getTargetValue()));
        if (request.unit() != null) goal.setUnit(request.unit());
        if (request.deadline() != null) goal.setDeadline(request.deadline());
        if (request.status() != null) goal.setStatus(request.status());
        if (request.color() != null) goal.setColor(request.color());
        syncDoneState(goal);
        return GoalDto.from(goalRepository.save(goal));
    }

    /** Add delta to current progress, clamped to [0, target], auto-flipping DONE/ACTIVE. */
    @Transactional
    public GoalDto addProgress(Long id, double delta) {
        Goal goal = getOwned(id);
        goal.setCurrentValue(clamp(goal.getCurrentValue() + delta, goal.getTargetValue()));
        syncDoneState(goal);
        return GoalDto.from(goalRepository.save(goal));
    }

    @Transactional
    public void delete(Long id) {
        goalRepository.delete(getOwned(id));
    }

    private Goal getOwned(Long id) {
        Long userId = currentUserService.getCurrentUserId();
        return goalRepository.findByIdAndUserId(id, userId)
                .orElseThrow(() -> new ResourceNotFoundException("Goal not found: " + id));
    }

    private static double clamp(double value, double target) {
        return Math.max(0, Math.min(target, value));
    }

    /** Keep ACTIVE/DONE in sync with progress, unless the user archived it. */
    private static void syncDoneState(Goal goal) {
        if (goal.getStatus() == GoalStatus.ARCHIVED) return;
        boolean reached = goal.getTargetValue() > 0 && goal.getCurrentValue() >= goal.getTargetValue();
        goal.setStatus(reached ? GoalStatus.DONE : GoalStatus.ACTIVE);
    }
}
