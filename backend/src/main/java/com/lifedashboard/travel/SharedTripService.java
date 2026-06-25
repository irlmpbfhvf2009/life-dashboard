package com.lifedashboard.travel;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.lifedashboard.security.CurrentUserService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.util.List;

@Service
@RequiredArgsConstructor
public class SharedTripService {

    private final SharedTripRepository repository;
    private final CurrentUserService currentUserService;
    private final ObjectMapper mapper = new ObjectMapper();

    private static final SecureRandom RANDOM = new SecureRandom();
    private static final String ALPHABET = "abcdefghijkmnpqrstuvwxyz23456789"; // no look-alikes
    private static final int TOKEN_LEN = 10;

    /** Snapshots the given trip JSON for the current user and returns its public token. */
    @Transactional
    public String share(JsonNode snapshot) {
        Long userId = currentUserService.getCurrentUserId();
        String json;
        try {
            json = mapper.writeValueAsString(snapshot);
        } catch (Exception e) {
            throw new IllegalArgumentException("invalid trip snapshot");
        }
        String token = uniqueToken();
        repository.save(SharedTrip.builder().token(token).userId(userId).snapshot(json).build());
        return token;
    }

    /** Public read: the raw snapshot JSON for a token, or null if not found. */
    @Transactional(readOnly = true)
    public JsonNode getByToken(String token) {
        return repository.findByToken(token)
                .map(e -> {
                    try {
                        return (JsonNode) mapper.readTree(e.getSnapshot());
                    } catch (Exception ex) {
                        return null;
                    }
                })
                .orElse(null);
    }

    /** The current user's shared trips (token + creation time + a small preview). */
    @Transactional(readOnly = true)
    public List<SharedTripSummary> listMine() {
        Long userId = currentUserService.getCurrentUserId();
        return repository.findByUserIdOrderByCreatedAtDesc(userId).stream()
                .map(this::toSummary)
                .toList();
    }

    private SharedTripSummary toSummary(SharedTrip e) {
        String destination = "";
        String departDate = "";
        int stops = 0;
        try {
            JsonNode snap = mapper.readTree(e.getSnapshot());
            JsonNode dest = snap.path("destination");
            String flag = dest.path("flag").asText("");
            String country = dest.path("country").asText("");
            String city = dest.path("city").asText("");
            destination = (flag + " " + country + (city.isEmpty() ? "" : "・" + city)).trim();
            departDate = snap.path("departDate").asText("");
            JsonNode itin = snap.path("itinerary");
            if (itin.isArray()) stops = itin.size();
        } catch (Exception ignored) {
            // best-effort preview only
        }
        return new SharedTripSummary(e.getToken(), e.getCreatedAt(), destination, departDate, stops);
    }

    /** Revoke one of the current user's shared links. */
    @Transactional
    public void revoke(String token) {
        Long userId = currentUserService.getCurrentUserId();
        repository.deleteByTokenAndUserId(token, userId);
    }

    private String uniqueToken() {
        for (int attempt = 0; attempt < 8; attempt++) {
            StringBuilder sb = new StringBuilder(TOKEN_LEN);
            for (int i = 0; i < TOKEN_LEN; i++) sb.append(ALPHABET.charAt(RANDOM.nextInt(ALPHABET.length())));
            String token = sb.toString();
            if (repository.findByToken(token).isEmpty()) return token;
        }
        throw new IllegalStateException("could not allocate a share token");
    }
}
