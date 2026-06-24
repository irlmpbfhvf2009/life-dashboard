package com.lifedashboard.english;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface EnglishStateRepository extends JpaRepository<EnglishState, Long> {
    Optional<EnglishState> findByUserId(Long userId);
}
