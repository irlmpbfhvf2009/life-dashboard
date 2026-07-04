package com.lifedashboard.plan;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface PlanStateRepository extends JpaRepository<PlanState, Long> {
    Optional<PlanState> findByUserId(Long userId);
}
