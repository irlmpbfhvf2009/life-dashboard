package com.lifedashboard.health;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.lifedashboard.security.CurrentUserService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class HealthStateService {

    private final HealthStateRepository repository;
    private final CurrentUserService currentUserService;
    private final ObjectMapper mapper = new ObjectMapper();

    /** Returns the stored health doc for the current user, or null if none yet. */
    @Transactional(readOnly = true)
    public JsonNode get() {
        Long userId = currentUserService.getCurrentUserId();
        return repository.findByUserId(userId)
                .map(e -> {
                    try {
                        return (JsonNode) mapper.readTree(e.getState());
                    } catch (Exception ex) {
                        return null;
                    }
                })
                .orElse(null);
    }

    /** Upserts the current user's health doc. */
    @Transactional
    public void save(JsonNode body) {
        Long userId = currentUserService.getCurrentUserId();
        String json;
        try {
            json = mapper.writeValueAsString(body);
        } catch (Exception e) {
            throw new IllegalArgumentException("invalid health json");
        }
        HealthState entity = repository.findByUserId(userId)
                .orElseGet(() -> HealthState.builder().userId(userId).build());
        entity.setState(json);
        repository.save(entity);
    }
}
