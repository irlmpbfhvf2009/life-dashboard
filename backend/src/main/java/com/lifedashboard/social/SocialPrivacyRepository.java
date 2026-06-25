package com.lifedashboard.social;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface SocialPrivacyRepository extends JpaRepository<SocialPrivacy, Long> {
    Optional<SocialPrivacy> findByUserId(Long userId);
}
