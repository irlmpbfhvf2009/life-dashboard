package com.lifedashboard.travel;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface SharedTripRepository extends JpaRepository<SharedTrip, Long> {
    Optional<SharedTrip> findByToken(String token);

    List<SharedTrip> findByUserIdOrderByCreatedAtDesc(Long userId);

    void deleteByTokenAndUserId(String token, Long userId);
}
