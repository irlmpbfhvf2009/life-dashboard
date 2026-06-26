package com.lifedashboard.journal;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface JournalRepository extends JpaRepository<Journal, Long> {

    List<Journal> findByUserIdOrderByEntryDateDescIdDesc(Long userId);

    Optional<Journal> findByIdAndUserId(Long id, Long userId);
}
