package com.lifedashboard.travel;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface TravelStateRepository extends JpaRepository<TravelState, Long> {
    Optional<TravelState> findByUserId(Long userId);
}
