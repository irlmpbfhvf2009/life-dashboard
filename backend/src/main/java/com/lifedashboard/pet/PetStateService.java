package com.lifedashboard.pet;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.lifedashboard.security.CurrentUserService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class PetStateService {

    private final PetStateRepository repository;
    private final CurrentUserService currentUserService;
    private final ObjectMapper mapper = new ObjectMapper();

    /** Returns the stored pet state for the current user, or null if none yet. */
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

    /** Upserts the current user's pet state document. */
    @Transactional
    public void save(JsonNode body) {
        Long userId = currentUserService.getCurrentUserId();
        String json;
        try {
            json = mapper.writeValueAsString(body);
        } catch (Exception e) {
            throw new IllegalArgumentException("invalid state json");
        }
        PetState entity = repository.findByUserId(userId)
                .orElseGet(() -> PetState.builder().userId(userId).build());
        entity.setState(json);
        repository.save(entity);
    }
}
