package com.lifedashboard.fx;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.lifedashboard.common.ApiResponse;
import com.lifedashboard.common.exception.ServiceUnavailableException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.client.RestClient;

import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Live foreign-exchange rates for the travel wallet. Proxies the free, key-less
 * open.er-api.com endpoint server-side and caches results (rates update ~daily),
 * so the UI can auto-fill "1 unit = ? TWD" instead of the user typing it.
 */
@Slf4j
@RestController
@RequestMapping("/api/fx")
public class FxController {

    public record FxRate(String from, String to, double rate, String asOf) {}

    private static final Set<String> ALLOWED = Set.of("THB", "JPY", "KRW", "VND", "TWD", "USD", "EUR");
    private static final Duration TTL = Duration.ofHours(6);

    private final ObjectMapper mapper = new ObjectMapper();
    private final RestClient http = RestClient.builder().baseUrl("https://open.er-api.com").build();
    private final Map<String, Cached> cache = new ConcurrentHashMap<>();

    private record Cached(FxRate rate, Instant at) {}

    @GetMapping("/rate")
    public ApiResponse<FxRate> rate(@RequestParam String from,
                                    @RequestParam(defaultValue = "TWD") String to) {
        String f = from.toUpperCase();
        String t = to.toUpperCase();
        if (!ALLOWED.contains(f) || !ALLOWED.contains(t)) {
            throw new IllegalArgumentException("unsupported currency");
        }

        String key = f + ">" + t;
        Cached c = cache.get(key);
        if (c != null && Duration.between(c.at(), Instant.now()).compareTo(TTL) < 0) {
            return ApiResponse.ok(c.rate());
        }

        try {
            String raw = http.get().uri("/v6/latest/{f}", f).retrieve().body(String.class);
            JsonNode n = mapper.readTree(raw);
            double rate = n.path("rates").path(t).asDouble(0);
            String asOf = n.path("time_last_update_utc").asText("");
            if (rate <= 0) throw new IllegalStateException("no rate for " + t);
            FxRate reply = new FxRate(f, t, rate, asOf);
            cache.put(key, new Cached(reply, Instant.now()));
            return ApiResponse.ok(reply);
        } catch (Exception e) {
            log.warn("FX fetch failed for {}>{}: {}", f, t, e.getMessage());
            if (c != null) return ApiResponse.ok(c.rate()); // serve stale rather than fail
            throw new ServiceUnavailableException("匯率服務暫時無法使用，請稍後再試");
        }
    }
}
