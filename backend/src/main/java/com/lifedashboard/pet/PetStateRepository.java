package com.lifedashboard.pet;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface PetStateRepository extends JpaRepository<PetState, Long> {
    Optional<PetState> findByUserId(Long userId);
}
