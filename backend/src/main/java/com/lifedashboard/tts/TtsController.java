package com.lifedashboard.tts;

import lombok.extern.slf4j.Slf4j;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.client.RestClient;

import java.time.Duration;
import java.util.Set;

/**
 * Free text-to-speech proxy. Browser-native speech only works when the OS has a
 * voice for the language installed — most Windows PCs have no Thai voice, so the
 * phrasebook would be silent. This fetches an MP3 from Google Translate's TTS
 * endpoint server-side (no API key, and server-side so the browser's CORS rules
 * don't apply) and streams it back, so audio works on any device.
 *
 * Behind the normal Firebase auth (/api/** is authenticated); the frontend calls
 * it with the user's token via axios and plays the returned blob.
 */
@Slf4j
@RestController
@RequestMapping("/api/tts")
public class TtsController {

    /** Languages the phrasebook / UI may request — guards the open proxy a bit. */
    private static final Set<String> ALLOWED_LANGS = Set.of("th", "ja", "ko", "vi", "en", "zh-TW", "zh-CN");
    /** Google's TTS endpoint rejects very long text; our phrases are short. */
    private static final int MAX_LEN = 200;

    private final RestClient http = RestClient.builder()
            .baseUrl("https://translate.google.com")
            .build();

    @GetMapping
    public ResponseEntity<byte[]> speak(@RequestParam String text,
                                        @RequestParam(defaultValue = "th") String lang) {
        String q = text == null ? "" : text.trim();
        if (q.isEmpty()) {
            return ResponseEntity.badRequest().build();
        }
        if (q.length() > MAX_LEN) {
            q = q.substring(0, MAX_LEN);
        }
        final String query = q;
        final String tl = ALLOWED_LANGS.contains(lang) ? lang : "th";

        try {
            byte[] audio = http.get()
                    .uri(b -> b.path("/translate_tts")
                            .queryParam("ie", "UTF-8")
                            .queryParam("client", "tw-ob")
                            .queryParam("tl", tl)
                            .queryParam("q", query)
                            .build())
                    // A browser-like UA is required, otherwise Google returns 403.
                    .header("User-Agent",
                            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                                    + "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36")
                    .retrieve()
                    .body(byte[].class);

            if (audio == null || audio.length == 0) {
                return ResponseEntity.status(502).build();
            }
            return ResponseEntity.ok()
                    .contentType(MediaType.valueOf("audio/mpeg"))
                    // Same phrase → same audio; let the browser cache it.
                    .cacheControl(CacheControl.maxAge(Duration.ofDays(7)).cachePublic())
                    .body(audio);
        } catch (Exception e) {
            log.warn("TTS proxy failed (lang={}, len={}): {}", tl, query.length(), e.getMessage());
            return ResponseEntity.status(502).build();
        }
    }
}
