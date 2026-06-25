package com.lifedashboard.ai;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.lifedashboard.ai.dto.ChatTurn;
import com.lifedashboard.ai.dto.PhraseReply;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Set;

/**
 * Turns a Traditional-Chinese phrase into traveler-friendly spoken phrases in a
 * chosen target language (Thai / Japanese / Korean / Vietnamese …) on top of
 * {@link GeminiClient}. The model returns structured JSON so the UI can show the
 * native script, romanization, a literal back-translation and a usage tip
 * separately. Degrades gracefully (503) when no key is configured.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class PhraseCoachService {

    private final GeminiClient gemini;
    private final ObjectMapper mapper = new ObjectMapper();

    /** Allow-list of target languages we support, to keep the prompt sane. */
    private static final Set<String> ALLOWED = Set.of("Thai", "Japanese", "Korean", "Vietnamese");

    public boolean isEnabled() {
        return gemini.isEnabled();
    }

    public PhraseReply translate(String message, String langName) {
        String target = ALLOWED.contains(langName) ? langName : "Thai";

        String system = """
                You are a helpful travel-language assistant for a Traditional-Chinese speaker
                visiting a country where the language is %s. Given the user's message (usually
                Traditional Chinese), produce a natural, polite spoken phrase a traveler would
                actually use. Return ONLY the required JSON object with:
                - "native": the natural spoken phrase in %s, in that language's native script.
                - "pronunciation": an easy romanized pronunciation a Chinese speaker can read aloud.
                - "literal": a literal back-translation into Traditional Chinese, to double-check meaning.
                - "polite": a more polite version (with the language's politeness markers). If already polite, repeat it.
                - "tip": a SHORT usage or cultural tip in Traditional Chinese. Leave empty if nothing useful.
                Keep everything concise and practical for real on-the-street use.
                """.formatted(target, target);

        ObjectNode schema = gemini.stringObjectSchema("native", "pronunciation", "literal", "polite", "tip");
        schema.putArray("required").add("native");

        List<ChatTurn> turns = List.of(new ChatTurn("user", message));
        String json = gemini.generateJson(system, turns, schema);
        try {
            JsonNode n = mapper.readTree(json);
            return new PhraseReply(
                    text(n, "native", ""),
                    text(n, "pronunciation", ""),
                    text(n, "literal", ""),
                    text(n, "polite", text(n, "native", "")),
                    text(n, "tip", ""));
        } catch (Exception e) {
            log.warn("Could not parse phrase translation JSON: {}", json);
            return new PhraseReply(json, "", "", json, "");
        }
    }

    private String text(JsonNode n, String field, String fallback) {
        String v = n.path(field).asText("").trim();
        return v.isBlank() ? fallback : v;
    }
}
