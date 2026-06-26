package com.lifedashboard.fasting;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface FastingRepository extends JpaRepository<FastingSession, Long> {

    Optional<FastingSession> findByUserIdAndEndAtIsNull(Long userId);

    List<FastingSession> findByUserIdAndEndAtIsNotNullOrderByStartAtDesc(Long userId, Pageable pageable);

    List<FastingSession> findByUserIdAndEndAtIsNotNull(Long userId);

    Optional<FastingSession> findByIdAndUserId(Long id, Long userId);
}
