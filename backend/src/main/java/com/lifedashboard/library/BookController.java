package com.lifedashboard.library;

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

import java.net.URI;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * Free, public-domain e-book library. Proxies two key-less sources server-side
 * (so the in-site reader avoids CORS and we can send a polite User-Agent):
 *   - Project Gutenberg via the Gutendex API (English & multilingual classics)
 *   - Chinese Wikisource (zh.wikisource.org) for Chinese public-domain texts
 *
 * Only public-domain content is served. Book full-text fetches are restricted
 * to the gutenberg.org domain (no arbitrary-URL fetching → no SSRF).
 */
@Slf4j
@RestController
@RequestMapping("/api/books")
public class BookController {

    private static final String UA = "PersonalIntelligenceStudio/1.0 (reading library; ws794613@gmail.com)";

    public record BookSummary(long id, String title, String author, List<String> languages, long downloads, boolean hasText) {}
    public record SearchResult(long count, List<BookSummary> results) {}
    public record BookText(long id, String title, String format, String content) {}
    public record ZhResult(String title, long pageid, String snippet) {}
    public record ZhPage(String title, String html) {}

    private final ObjectMapper mapper = new ObjectMapper();
    private final RestClient gutendex = RestClient.builder().baseUrl("https://gutendex.com").build();
    private final RestClient wikisource = RestClient.builder().baseUrl("https://zh.wikisource.org").build();
    private final RestClient httpRaw = RestClient.create();

    // ---- Project Gutenberg (Gutendex) ----

    /** Search Gutenberg, or return popular books when q is blank. */
    @GetMapping("/search")
    public ApiResponse<SearchResult> search(@RequestParam(defaultValue = "") String q,
                                            @RequestParam(defaultValue = "1") int page) {
        try {
            String raw = gutendex.get()
                    .uri(b -> b.path("/books")
                            .queryParam("search", q.trim())
                            .queryParam("page", Math.max(1, page))
                            .build())
                    .header("User-Agent", UA)
                    .retrieve()
                    .body(String.class);
            JsonNode root = mapper.readTree(raw);
            long count = root.path("count").asLong(0);
            List<BookSummary> out = new ArrayList<>();
            for (JsonNode n : root.path("results")) {
                out.add(toSummary(n));
            }
            return ApiResponse.ok(new SearchResult(count, out));
        } catch (Exception e) {
            log.warn("gutendex search failed for '{}': {}", q, e.getMessage());
            throw new ServiceUnavailableException("書庫服務暫時無法使用，請稍後再試");
        }
    }

    /** Full text of a Gutenberg book (plain text preferred, HTML fallback). */
    @GetMapping("/text")
    public ApiResponse<BookText> text(@RequestParam long id) {
        try {
            String meta = gutendex.get().uri("/books/{id}", id)
                    .header("User-Agent", UA).retrieve().body(String.class);
            JsonNode n = mapper.readTree(meta);
            String title = n.path("title").asText("");
            JsonNode formats = n.path("formats");

            String txtUrl = pickFormat(formats, "text/plain");
            String htmlUrl = txtUrl == null ? pickFormat(formats, "text/html") : null;
            String url = txtUrl != null ? txtUrl : htmlUrl;
            String format = txtUrl != null ? "text" : "html";
            if (url == null || !isGutenbergHost(url)) {
                throw new ServiceUnavailableException("這本書沒有可閱讀的純文字版本");
            }

            String body = httpRaw.get().uri(URI.create(url)).header("User-Agent", UA).retrieve().body(String.class);
            if ("text".equals(format)) body = stripGutenbergBoilerplate(body);
            return ApiResponse.ok(new BookText(id, title, format, body));
        } catch (ServiceUnavailableException e) {
            throw e;
        } catch (Exception e) {
            log.warn("gutenberg text fetch failed for {}: {}", id, e.getMessage());
            throw new ServiceUnavailableException("無法取得這本書的內容，請稍後再試");
        }
    }

    // ---- Chinese Wikisource ----

    @GetMapping("/zh/search")
    public ApiResponse<List<ZhResult>> zhSearch(@RequestParam String q) {
        try {
            String raw = wikisource.get()
                    .uri(b -> b.path("/w/api.php")
                            .queryParam("action", "query")
                            .queryParam("list", "search")
                            .queryParam("srsearch", q.trim())
                            .queryParam("srlimit", 20)
                            .queryParam("srnamespace", 0)
                            .queryParam("format", "json")
                            .build())
                    .header("User-Agent", UA)
                    .retrieve()
                    .body(String.class);
            JsonNode hits = mapper.readTree(raw).path("query").path("search");
            List<ZhResult> out = new ArrayList<>();
            for (JsonNode h : hits) {
                String snippet = h.path("snippet").asText("").replaceAll("<[^>]+>", "");
                out.add(new ZhResult(h.path("title").asText(""), h.path("pageid").asLong(), snippet));
            }
            return ApiResponse.ok(out);
        } catch (Exception e) {
            log.warn("wikisource search failed for '{}': {}", q, e.getMessage());
            throw new ServiceUnavailableException("中文書庫服務暫時無法使用，請稍後再試");
        }
    }

    @GetMapping("/zh/page")
    public ApiResponse<ZhPage> zhPage(@RequestParam String title) {
        try {
            String raw = wikisource.get()
                    .uri(b -> b.path("/w/api.php")
                            .queryParam("action", "parse")
                            .queryParam("page", title)
                            .queryParam("prop", "text")
                            .queryParam("disableeditsection", "true")
                            .queryParam("disabletoc", "true")
                            .queryParam("formatversion", 2)
                            .queryParam("format", "json")
                            .build())
                    .header("User-Agent", UA)
                    .retrieve()
                    .body(String.class);
            JsonNode parse = mapper.readTree(raw).path("parse");
            return ApiResponse.ok(new ZhPage(parse.path("title").asText(title), parse.path("text").asText("")));
        } catch (Exception e) {
            log.warn("wikisource page fetch failed for '{}': {}", title, e.getMessage());
            throw new ServiceUnavailableException("無法取得這篇內容，請稍後再試");
        }
    }

    // ---- helpers ----

    private BookSummary toSummary(JsonNode n) {
        List<String> langs = new ArrayList<>();
        for (JsonNode l : n.path("languages")) langs.add(l.asText());
        String author = "";
        JsonNode authors = n.path("authors");
        if (authors.isArray() && authors.size() > 0) author = authors.get(0).path("name").asText("");
        boolean hasText = pickFormat(n.path("formats"), "text/plain") != null
                || pickFormat(n.path("formats"), "text/html") != null;
        return new BookSummary(
                n.path("id").asLong(),
                n.path("title").asText(""),
                author,
                langs,
                n.path("download_count").asLong(0),
                hasText);
    }

    /** First format URL whose mime key starts with the given prefix and isn't a zip. */
    private String pickFormat(JsonNode formats, String mimePrefix) {
        if (formats == null || !formats.isObject()) return null;
        String fallback = null;
        var it = formats.fields();
        while (it.hasNext()) {
            Map.Entry<String, JsonNode> e = it.next();
            if (!e.getKey().startsWith(mimePrefix)) continue;
            String url = e.getValue().asText("");
            if (url.endsWith(".zip")) continue;
            if (e.getKey().contains("utf-8")) return url; // prefer UTF-8
            if (fallback == null) fallback = url;
        }
        return fallback;
    }

    private boolean isGutenbergHost(String url) {
        try {
            String host = URI.create(url).getHost();
            return host != null && (host.equals("gutenberg.org") || host.endsWith(".gutenberg.org"));
        } catch (Exception e) {
            return false;
        }
    }

    /** Trim Project Gutenberg's legal header/footer so the reader shows just the book. */
    private String stripGutenbergBoilerplate(String text) {
        if (text == null) return "";
        int start = indexAfterLine(text, "*** START OF");
        int end = text.indexOf("*** END OF");
        if (start < 0) start = 0;
        if (end < 0 || end <= start) end = text.length();
        return text.substring(start, end).strip();
    }

    private int indexAfterLine(String text, String marker) {
        int i = text.indexOf(marker);
        if (i < 0) return -1;
        int nl = text.indexOf('\n', i);
        return nl < 0 ? -1 : nl + 1;
    }
}
