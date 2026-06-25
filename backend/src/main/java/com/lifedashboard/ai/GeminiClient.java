package com.lifedashboard.ai;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.lifedashboard.ai.dto.ChatTurn;
import com.lifedashboard.common.exception.ServiceUnavailableException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.util.List;

/**
 * Thin client over Google's Gemini {@code generateContent} REST API.
 *
 * The key is read from config and may be blank — in that case {@link #isEnabled()}
 * returns false and callers should degrade gracefully rather than calling out.
 */
@Slf4j
@Component
public class GeminiClient {

    private final String apiKey;
    private final String model;
    private final ObjectMapper mapper = new ObjectMapper();
    private final RestClient http;

    public GeminiClient(
            @Value("${app.gemini.api-key:}") String apiKey,
            @Value("${app.gemini.model:gemini-2.5-flash}") String model,
            @Value("${app.gemini.base-url:https://generativelanguage.googleapis.com/v1beta}") String baseUrl) {
        this.apiKey = apiKey == null ? "" : apiKey.trim();
        this.model = model;
        this.http = RestClient.builder().baseUrl(baseUrl).build();
    }

    public boolean isEnabled() {
        return !apiKey.isBlank();
    }

    /**
     * Calls Gemini with a system instruction, conversation turns and a JSON
     * response schema, returning the model's raw text (which conforms to the
     * schema). Throws {@link ServiceUnavailableException} when not configured or
     * the upstream call fails.
     */
    public String generateJson(String systemInstruction, List<ChatTurn> turns, ObjectNode responseSchema) {
        if (!isEnabled()) {
            throw new ServiceUnavailableException("AI 尚未設定（缺少 GEMINI_API_KEY）");
        }

        ObjectNode body = mapper.createObjectNode();

        ObjectNode sys = body.putObject("systemInstruction");
        sys.putArray("parts").addObject().put("text", systemInstruction);

        ArrayNode contents = body.putArray("contents");
        for (ChatTurn turn : turns) {
            ObjectNode c = contents.addObject();
            c.put("role", "model".equals(turn.role()) ? "model" : "user");
            c.putArray("parts").addObject().put("text", turn.content());
        }

        ObjectNode gen = body.putObject("generationConfig");
        gen.put("temperature", 0.7);
        gen.put("responseMimeType", "application/json");
        gen.set("responseSchema", responseSchema);

        return execute(body);
    }

    /**
     * Like {@link #generateJson} but with a single user message that includes an
     * inline image (base64) — for vision tasks such as reading a receipt.
     */
    public String generateJsonWithImage(String systemInstruction, String userText,
                                        String base64Image, String mimeType, ObjectNode responseSchema) {
        if (!isEnabled()) {
            throw new ServiceUnavailableException("AI 尚未設定（缺少 GEMINI_API_KEY）");
        }

        ObjectNode body = mapper.createObjectNode();
        ObjectNode sys = body.putObject("systemInstruction");
        sys.putArray("parts").addObject().put("text", systemInstruction);

        ArrayNode contents = body.putArray("contents");
        ObjectNode c = contents.addObject();
        c.put("role", "user");
        ArrayNode parts = c.putArray("parts");
        parts.addObject().put("text", userText);
        ObjectNode inline = parts.addObject().putObject("inlineData");
        inline.put("mimeType", mimeType == null || mimeType.isBlank() ? "image/jpeg" : mimeType);
        inline.put("data", base64Image);

        ObjectNode gen = body.putObject("generationConfig");
        gen.put("temperature", 0.2); // factual extraction — keep it tight
        gen.put("responseMimeType", "application/json");
        gen.set("responseSchema", responseSchema);

        return execute(body);
    }

    /** Posts a fully-built request body and returns the model's text part. */
    private String execute(ObjectNode body) {
        try {
            String raw = http.post()
                    .uri(uriBuilder -> uriBuilder
                            .path("/models/{model}:generateContent")
                            .queryParam("key", apiKey)
                            .build(model))
                    .header("Content-Type", "application/json")
                    .body(mapper.writeValueAsString(body))
                    .retrieve()
                    .body(String.class);

            JsonNode root = mapper.readTree(raw);
            JsonNode text = root.path("candidates").path(0).path("content").path("parts").path(0).path("text");
            if (text.isMissingNode() || text.asText().isBlank()) {
                JsonNode blocked = root.path("promptFeedback").path("blockReason");
                if (!blocked.isMissingNode()) {
                    throw new ServiceUnavailableException("AI 拒絕了這個請求（內容安全）：" + blocked.asText());
                }
                log.warn("Gemini returned no text: {}", raw);
                throw new ServiceUnavailableException("AI 暫時無法回應，請稍後再試");
            }
            return text.asText();
        } catch (ServiceUnavailableException e) {
            throw e;
        } catch (Exception e) {
            log.error("Gemini call failed", e);
            throw new ServiceUnavailableException("AI 服務暫時無法使用，請稍後再試");
        }
    }

    /** Helper to build a flat string-property JSON schema. */
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
