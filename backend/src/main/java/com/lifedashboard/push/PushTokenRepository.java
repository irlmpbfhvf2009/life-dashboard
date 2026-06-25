package com.lifedashboard.push;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface PushTokenRepository extends JpaRepository<PushToken, Long> {

    Optional<PushToken> findByToken(String token);

    List<PushToken> findByUserIdIn(List<Long> userIds);

    void deleteByToken(String token);
}
