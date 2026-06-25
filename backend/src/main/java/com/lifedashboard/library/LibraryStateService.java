package com.lifedashboard.library;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.lifedashboard.security.CurrentUserService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class LibraryStateService {

    private final LibraryStateRepository repository;
    private final CurrentUserService currentUserService;
    private final ObjectMapper mapper = new ObjectMapper();

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

    @Transactional
    public void save(JsonNode body) {
        Long userId = currentUserService.getCurrentUserId();
        String json;
        try {
            json = mapper.writeValueAsString(body);
        } catch (Exception e) {
            throw new IllegalArgumentException("invalid state json");
        }
        LibraryState entity = repository.findByUserId(userId)
                .orElseGet(() -> LibraryState.builder().userId(userId).build());
        entity.setState(json);
        repository.save(entity);
    }
}
