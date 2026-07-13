package com.lifedashboard.ai;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.lifedashboard.ai.dto.ChatTurn;
import com.lifedashboard.common.exception.ServiceUnavailableException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClient;

import java.net.http.HttpClient;
import java.time.Duration;
import java.util.List;

/**
 * Provider-agnostic AI client. The provider / model / key are resolved per
 * request by {@link AiKeyResolver}; this class serialises the same logical call
 * (system prompt + turns + optional image + a request for JSON) into whichever
 * dialect the chosen provider speaks (Gemini native, OpenAI-compatible, or
 * Anthropic). Callers get {@link #isEnabled()} == false and graceful 503s when
 * the current user has no usable key.
 */
@Slf4j
@Component
public class AiClient {

    private static final String NOT_CONFIGURED = "AI 尚未啟用（請到「設定」頁選擇 AI 並填入你的金鑰）";
    private static final String JSON_ONLY = "\n\nReturn ONLY a single valid JSON object. No markdown, no code fences, no commentary.";

    private final ObjectMapper mapper = new ObjectMapper();
    // Explicit timeouts matter here: Cloud Run kills the whole request at its own
    // configured timeout (see infra: timeoutSeconds) and the resulting 504 carries
    // no CORS header, so the browser only ever sees a bare "Network Error". Failing
    // fast (and well before that ceiling) lets our own code return a clean, CORS-ed
    // error instead.
    private final RestClient http = restClient(Duration.ofSeconds(90));
    private final RestClient validateHttp = restClient(Duration.ofSeconds(20));
    private final AiKeyResolver resolver;

    public AiClient(AiKeyResolver resolver) {
        this.resolver = resolver;
    }

    private static RestClient restClient(Duration readTimeout) {
        JdkClientHttpRequestFactory factory = new JdkClientHttpRequestFactory(
                HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build());
        factory.setReadTimeout(readTimeout);
        return RestClient.builder().requestFactory(factory).build();
    }

    /** Whether AI is available to the current user (own key, or admin shared key). */
    public boolean isEnabled() {
        return resolver.available();
    }

    public String generateJson(String system, List<ChatTurn> turns, ObjectNode responseSchema) {
        AiConfig cfg = requireConfig();
        return dispatch(cfg, system, turns, responseSchema, null, null);
    }

    public String generateJsonWithImage(String system, String userText,
                                        String base64Image, String mimeType, ObjectNode responseSchema) {
        AiConfig cfg = requireConfig();
        List<ChatTurn> turns = List.of(new ChatTurn("user", userText));
        return dispatch(cfg, system, turns, responseSchema, base64Image, mimeType);
    }

    private AiConfig requireConfig() {
        AiConfig cfg = resolver.resolve();
        if (cfg == null || cfg.apiKey().isBlank()) {
            throw new ServiceUnavailableException(NOT_CONFIGURED);
        }
        return cfg;
    }

    private String dispatch(AiConfig cfg, String system, List<ChatTurn> turns,
                            ObjectNode schema, String img, String mime) {
        try {
            return switch (cfg.provider().style) {
                case GEMINI -> gemini(cfg, system, turns, schema, img, mime);
                case OPENAI -> openai(cfg, system, turns, img, mime);
                case ANTHROPIC -> anthropic(cfg, system, turns, img, mime);
            };
        } catch (ServiceUnavailableException e) {
            throw e;
        } catch (ResourceAccessException e) {
            log.warn("AI call timed out ({} {}): {}", cfg.provider(), cfg.model(), e.getMessage());
            throw new ServiceUnavailableException("AI 回應時間過長，請稍後再試一次（或描述簡短一點、照片小一點）");
        } catch (Exception e) {
            log.error("AI call failed ({} {})", cfg.provider(), cfg.model(), e);
            throw new ServiceUnavailableException("AI 服務暫時無法使用，請稍後再試（或確認你的金鑰與模型）");
        }
    }

    // ---- Gemini (native generateContent) ----

    private String gemini(AiConfig cfg, String system, List<ChatTurn> turns,
                          ObjectNode schema, String img, String mime) throws Exception {
        ObjectNode body = mapper.createObjectNode();
        body.putObject("systemInstruction").putArray("parts").addObject().put("text", system);

        ArrayNode contents = body.putArray("contents");
        for (int i = 0; i < turns.size(); i++) {
            ChatTurn turn = turns.get(i);
            ObjectNode c = contents.addObject();
            c.put("role", "model".equals(turn.role()) ? "model" : "user");
            ArrayNode parts = c.putArray("parts");
            parts.addObject().put("text", turn.content());
            if (img != null && i == turns.size() - 1) {
                ObjectNode inline = parts.addObject().putObject("inlineData");
                inline.put("mimeType", mime == null || mime.isBlank() ? "image/jpeg" : mime);
                inline.put("data", img);
            }
        }

        ObjectNode gen = body.putObject("generationConfig");
        gen.put("temperature", img != null ? 0.2 : 0.7);
        gen.put("responseMimeType", "application/json");
        if (schema != null) gen.set("responseSchema", schema);

        String url = cfg.provider().baseUrl + "/models/" + cfg.model() + ":generateContent?key=" + cfg.apiKey();
        String raw = post(url, body, null, null);
        JsonNode text = mapper.readTree(raw)
                .path("candidates").path(0).path("content").path("parts").path(0).path("text");
        if (text.isMissingNode() || text.asText().isBlank()) {
            log.warn("Gemini returned no text: {}", raw);
            throw new ServiceUnavailableException("AI 暫時無法回應，請稍後再試");
        }
        return text.asText();
    }

    // ---- OpenAI-compatible (OpenAI / DeepSeek / Groq / Mistral) ----

    private String openai(AiConfig cfg, String system, List<ChatTurn> turns,
                          String img, String mime) throws Exception {
        ObjectNode body = mapper.createObjectNode();
        body.put("model", cfg.model());
        body.put("temperature", img != null ? 0.2 : 0.5);

        ArrayNode messages = body.putArray("messages");
        messages.addObject().put("role", "system").put("content", system + JSON_ONLY);
        for (int i = 0; i < turns.size(); i++) {
            ChatTurn turn = turns.get(i);
            ObjectNode m = messages.addObject();
            m.put("role", "model".equals(turn.role()) ? "assistant" : "user");
            if (img != null && i == turns.size() - 1) {
                ArrayNode content = m.putArray("content");
                content.addObject().put("type", "text").put("text", turn.content());
                ObjectNode imgPart = content.addObject();
                imgPart.put("type", "image_url");
                imgPart.putObject("image_url").put("url",
                        "data:" + (mime == null || mime.isBlank() ? "image/jpeg" : mime) + ";base64," + img);
            } else {
                m.put("content", turn.content());
            }
        }

        String raw = post(cfg.provider().baseUrl + "/chat/completions", body,
                "Authorization", "Bearer " + cfg.apiKey());
        JsonNode text = mapper.readTree(raw).path("choices").path(0).path("message").path("content");
        if (text.isMissingNode() || text.asText().isBlank()) {
            log.warn("OpenAI-compatible returned no text: {}", raw);
            throw new ServiceUnavailableException("AI 暫時無法回應，請稍後再試");
        }
        return stripFences(text.asText());
    }

    // ---- Anthropic (messages API) ----

    private String anthropic(AiConfig cfg, String system, List<ChatTurn> turns,
                             String img, String mime) throws Exception {
        ObjectNode body = mapper.createObjectNode();
        body.put("model", cfg.model());
        body.put("max_tokens", 2048);
        body.put("system", system + JSON_ONLY);

        ArrayNode messages = body.putArray("messages");
        for (int i = 0; i < turns.size(); i++) {
            ChatTurn turn = turns.get(i);
            ObjectNode m = messages.addObject();
            m.put("role", "model".equals(turn.role()) ? "assistant" : "user");
            if (img != null && i == turns.size() - 1) {
                ArrayNode content = m.putArray("content");
                content.addObject().put("type", "text").put("text", turn.content());
                ObjectNode imgPart = content.addObject();
                imgPart.put("type", "image");
                ObjectNode src = imgPart.putObject("source");
                src.put("type", "base64");
                src.put("media_type", mime == null || mime.isBlank() ? "image/jpeg" : mime);
                src.put("data", img);
            } else {
                m.put("content", turn.content());
            }
        }

        String raw = post(cfg.provider().baseUrl + "/messages", body,
                "x-api-key", cfg.apiKey());
        JsonNode text = mapper.readTree(raw).path("content").path(0).path("text");
        if (text.isMissingNode() || text.asText().isBlank()) {
            log.warn("Anthropic returned no text: {}", raw);
            throw new ServiceUnavailableException("AI 暫時無法回應，請稍後再試");
        }
        return stripFences(text.asText());
    }

    // ---- Shared HTTP + helpers ----

    private String post(String url, ObjectNode body, String headerName, String headerValue) throws Exception {
        return post(http, url, body, headerName, headerValue);
    }

    private String post(RestClient client, String url, ObjectNode body, String headerName, String headerValue) throws Exception {
        var spec = client.post().uri(url).header("Content-Type", "application/json");
        if (headerName != null) spec = spec.header(headerName, headerValue);
        if (url.contains("api.anthropic.com")) spec = spec.header("anthropic-version", "2023-06-01");
        return spec.body(mapper.writeValueAsString(body)).retrieve().body(String.class);
    }

    /** Strip ```json … ``` fences some providers wrap JSON in. */
    private String stripFences(String s) {
        String t = s.trim();
        if (t.startsWith("```")) {
            int nl = t.indexOf('\n');
            if (nl >= 0) t = t.substring(nl + 1);
            if (t.endsWith("```")) t = t.substring(0, t.length() - 3);
        }
        return t.trim();
    }

    /**
     * Verifies a candidate provider + key + model with a minimal live call — used
     * before saving so a wrong paste fails fast. Returns false on any error.
     */
    public boolean validate(AiProvider provider, String key, String model) {
        if (key == null || key.isBlank()) return false;
        String m = (model == null || model.isBlank()) ? AiCatalog.defaultModel(provider) : model.trim();
        try {
            switch (provider.style) {
                case GEMINI -> {
                    ObjectNode body = mapper.createObjectNode();
                    body.putArray("contents").addObject().put("role", "user")
                            .putArray("parts").addObject().put("text", "ping");
                    body.putObject("generationConfig").put("maxOutputTokens", 1);
                    post(validateHttp, provider.baseUrl + "/models/" + m + ":generateContent?key=" + key.trim(), body, null, null);
                }
                case OPENAI -> {
                    ObjectNode body = mapper.createObjectNode();
                    body.put("model", m);
                    body.put("max_tokens", 1);
                    body.putArray("messages").addObject().put("role", "user").put("content", "ping");
                    post(validateHttp, provider.baseUrl + "/chat/completions", body, "Authorization", "Bearer " + key.trim());
                }
                case ANTHROPIC -> {
                    ObjectNode body = mapper.createObjectNode();
                    body.put("model", m);
                    body.put("max_tokens", 1);
                    body.putArray("messages").addObject().put("role", "user").put("content", "ping");
                    post(validateHttp, provider.baseUrl + "/messages", body, "x-api-key", key.trim());
                }
            }
            return true;
        } catch (Exception e) {
            log.warn("AI key validation failed ({} {}): {}", provider, m, e.getMessage());
            return false;
        }
    }

    /** Helper to build a flat string-property JSON schema (Gemini format). */
    public ObjectNode stringObjectSchema(String... props) {
        ObjectNode schema = mapper.createObjectNode();
        schema.put("type", "OBJECT");
        ObjectNode properties = schema.putObject("properties");
        for (String p : props) {
            properties.putObject(p).put("type", "STRING");
        }
        return schema;
    }
}
