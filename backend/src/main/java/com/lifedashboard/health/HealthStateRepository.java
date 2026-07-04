package com.lifedashboard.health;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface HealthStateRepository extends JpaRepository<HealthState, Long> {
    Optional<HealthState> findByUserId(Long userId);
}
