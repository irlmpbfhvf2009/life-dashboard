package com.lifedashboard.gif;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.lifedashboard.common.ApiResponse;
import com.lifedashboard.common.exception.ServiceUnavailableException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.client.RestClient;

import java.util.ArrayList;
import java.util.List;

/**
 * GIF search via the GIPHY API, proxied server-side so the API key stays on the
 * backend and we avoid browser CORS. Returns a trimmed list (a chat-sized gif + a
 * small preview + dims). The chat stores only the remote gif URL — nothing is
 * uploaded to our Storage. If GIPHY_API_KEY is unset the endpoints return a
 * friendly 503 and the GIF picker shows a "not enabled" notice.
 *
 * (We originally targeted Tenor, but Tenor's API can't be enabled on this GCP
 * project — serviceusage returns 110002 PERMISSION_DENIED — so GIPHY is used.)
 */
@Slf4j
@RestController
@RequestMapping("/api/gif")
public class GifController {

    /** One result: {@code url}=chat-sized gif, {@code preview}=small gif for the grid. */
    public record Gif(String id, String url, String preview, int width, int height, String description) {}

    public record GifPage(List<Gif> results, String next) {}

    private static final int LIMIT = 24;

    @Value("${app.giphy.api-key:}")
    private String apiKey;

    private final ObjectMapper mapper = new ObjectMapper();
    private final RestClient http = RestClient.builder().baseUrl("https://api.giphy.com").build();

    @GetMapping("/search")
    public ApiResponse<GifPage> search(@RequestParam String q,
                                       @RequestParam(required = false) String pos) {
        requireKey();
        return ApiResponse.ok(fetch("/v1/gifs/search", q, offset(pos)));
    }

    @GetMapping("/featured")
    public ApiResponse<GifPage> featured(@RequestParam(required = false) String pos) {
        requireKey();
        return ApiResponse.ok(fetch("/v1/gifs/trending", null, offset(pos)));
    }

    private void requireKey() {
        if (!StringUtils.hasText(apiKey)) {
            throw new ServiceUnavailableException("GIF 服務尚未啟用");
        }
    }

    private int offset(String pos) {
        try {
            return StringUtils.hasText(pos) ? Math.max(0, Integer.parseInt(pos)) : 0;
        } catch (NumberFormatException e) {
            return 0;
        }
    }

    /** Call GIPHY and parse, turning any upstream failure into a clean 503 so the
     *  picker degrades gracefully. */
    private GifPage fetch(String path, String q, int offset) {
        try {
            String raw = http.get().uri(uri -> {
                        uri.path(path)
                           .queryParam("api_key", apiKey)
                           .queryParam("limit", LIMIT)
                           .queryParam("offset", offset)
                           .queryParam("rating", "pg-13")
                           .queryParam("bundle", "messaging_non_clips");
                        if (StringUtils.hasText(q)) uri.queryParam("q", q);
                        return uri.build();
                    })
                    .retrieve().body(String.class);
            return parse(raw, offset);
        } catch (ServiceUnavailableException e) {
            throw e;
        } catch (Exception e) {
            log.warn("GIPHY request failed ({}): {}", path, e.getMessage());
            throw new ServiceUnavailableException("GIF 服務暫時無法使用");
        }
    }

    private GifPage parse(String raw, int offset) {
        try {
            JsonNode root = mapper.readTree(raw);
            List<Gif> out = new ArrayList<>();
            for (JsonNode r : root.path("data")) {
                JsonNode images = r.path("images");
                // Chat-sized gif (capped width); fall back to the original.
                JsonNode main = firstPresent(images, "fixed_width", "downsized", "original");
                String url = main.path("url").asText(null);
                if (url == null) continue;
                // Small preview for the grid.
                JsonNode prev = firstPresent(images, "fixed_width_small", "preview_gif", "fixed_width");
                String preview = prev.path("url").asText(url);
                out.add(new Gif(
                        r.path("id").asText(""),
                        url,
                        preview,
                        main.path("width").asInt(0),
                        main.path("height").asInt(0),
                        r.path("title").asText("")
                ));
            }
            // GIPHY paginates by offset; expose the next offset for forward-compat.
            int count = root.path("pagination").path("count").asInt(out.size());
            String next = count >= LIMIT ? String.valueOf(offset + LIMIT) : "";
            return new GifPage(out, next);
        } catch (Exception e) {
            log.warn("GIPHY parse failed: {}", e.getMessage());
            throw new ServiceUnavailableException("GIF 服務暫時無法使用");
        }
    }

    private JsonNode firstPresent(JsonNode images, String... keys) {
        for (String k : keys) {
            JsonNode n = images.path(k);
            if (n.has("url")) return n;
        }
        return images.path(keys[keys.length - 1]);
    }
}
