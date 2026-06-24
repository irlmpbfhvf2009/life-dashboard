package com.lifedashboard.ai;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.lifedashboard.ai.dto.ChatReply;
import com.lifedashboard.ai.dto.ChatRequest;
import com.lifedashboard.ai.dto.ChatTurn;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

/**
 * Drives a friendly English-conversation tutor on top of {@link GeminiClient}.
 * The model is asked to return structured JSON ({@code reply} + optional
 * {@code correction}) so the frontend can show gentle corrections separately.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class EnglishCoachService {

    private final GeminiClient gemini;
    private final ObjectMapper mapper = new ObjectMapper();

    private static final String SYSTEM = """
            You are a warm, encouraging English conversation tutor for a Traditional-Chinese-speaking learner.
            Goals:
            - Hold a natural, friendly conversation in English. Keep your reply concise (1-3 sentences) and end with a question to keep the chat going.
            - Match the learner's level; use clear, everyday English. Do not lecture.
            - If the learner's message has grammar, word-choice or phrasing mistakes, put a SHORT, friendly correction in the "correction" field, written in Traditional Chinese, quoting the fix (e.g. 「應該說 "I went" 而不是 "I goed"」). If their English is already fine, leave "correction" empty.
            - Never include the correction inside "reply"; keep "reply" purely conversational English.
            Always answer with the required JSON object only.
            """;

    public boolean isEnabled() {
        return gemini.isEnabled();
    }

    public ChatReply chat(ChatRequest request) {
        List<ChatTurn> turns = new ArrayList<>();
        if (request.history() != null) {
            // Cap context to the last 12 turns to keep tokens (and cost) bounded.
            List<ChatTurn> h = request.history();
            int from = Math.max(0, h.size() - 12);
            for (int i = from; i < h.size(); i++) {
                ChatTurn t = h.get(i);
                if (t != null && t.content() != null && !t.content().isBlank()) turns.add(t);
            }
        }
        turns.add(new ChatTurn("user", request.message()));

        ObjectNode schema = gemini.stringObjectSchema("reply", "correction");
        schema.putArray("required").add("reply");

        String json = gemini.generateJson(SYSTEM, turns, schema);
        try {
            JsonNode node = mapper.readTree(json);
            String reply = node.path("reply").asText("").trim();
            String correction = node.path("correction").asText("").trim();
            return new ChatReply(reply, correction.isBlank() ? null : correction);
        } catch (Exception e) {
            log.warn("Could not parse coach JSON, returning raw text: {}", json);
            return new ChatReply(json, null);
        }
    }
}
