package com.lifedashboard.geo;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.lifedashboard.common.ApiResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.client.RestClient;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Geocoding proxy for the itinerary map. Proxies OpenStreetMap's Nominatim
 * server-side (so we can send a proper User-Agent per their usage policy, and
 * cache results) and returns the best lat/lon for a place query. Returns null
 * when nothing is found — the map just skips that place.
 */
@Slf4j
@RestController
@RequestMapping("/api/geo")
public class GeoController {

    public record GeoResult(double lat, double lon, String displayName) {}

    private static final GeoResult NONE = new GeoResult(0, 0, "");

    private final ObjectMapper mapper = new ObjectMapper();
    private final RestClient http = RestClient.builder().baseUrl("https://nominatim.openstreetmap.org").build();
    private final Map<String, GeoResult> cache = new ConcurrentHashMap<>();

    @GetMapping
    public ApiResponse<GeoResult> geocode(@RequestParam String q) {
        String key = q.trim().toLowerCase();
        if (key.isEmpty()) return ApiResponse.ok(null);

        GeoResult cached = cache.get(key);
        if (cached != null) return ApiResponse.ok(cached == NONE ? null : cached);

        try {
            String raw = http.get()
                    .uri(b -> b.path("/search")
                            .queryParam("q", q)
                            .queryParam("format", "jsonv2")
                            .queryParam("limit", 1)
                            .build())
                    // Nominatim requires a descriptive User-Agent identifying the app.
                    .header("User-Agent", "PersonalIntelligenceStudio/1.0 (travel itinerary map; ws794613@gmail.com)")
                    .retrieve()
                    .body(String.class);

            JsonNode arr = mapper.readTree(raw);
            if (arr.isArray() && arr.size() > 0) {
                JsonNode n = arr.get(0);
                GeoResult r = new GeoResult(
                        n.path("lat").asDouble(), n.path("lon").asDouble(), n.path("display_name").asText(""));
                cache.put(key, r);
                return ApiResponse.ok(r);
            }
            cache.put(key, NONE);
            return ApiResponse.ok(null);
        } catch (Exception e) {
            log.warn("geocode failed for '{}': {}", q, e.getMessage());
            return ApiResponse.ok(null);
        }
    }
}
