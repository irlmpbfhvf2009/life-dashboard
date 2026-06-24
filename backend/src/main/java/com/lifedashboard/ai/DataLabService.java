package com.lifedashboard.ai;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.lifedashboard.ai.dto.DataInsightReply;
import com.lifedashboard.ai.dto.ChatTurn;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

/**
 * Turns a dataset profile into plain-language insights via {@link GeminiClient}.
 * Reuses the same JSON-structured-output approach as the English coach.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class DataLabService {

    private final GeminiClient gemini;
    private final ObjectMapper mapper = new ObjectMapper();

    private static final String SYSTEM = """
            You are a friendly data analyst. You are given a compact profile of a dataset
            (column names, row count, numeric statistics and a few sample rows).
            Reply IN TRADITIONAL CHINESE with:
            - "summary": 1-2 sentences describing what this dataset appears to be about.
            - "findings": 3-5 concrete observations grounded in the numbers (trends, ranges,
              outliers, distributions, correlations you can reasonably infer).
            - "suggestions": 2-4 actionable next steps or analyses worth doing.
            Be specific and reference real column names. Do not invent data you cannot see.
            Answer with the required JSON object only.
            """;

    public boolean isEnabled() {
        return gemini.isEnabled();
    }

    public DataInsightReply analyze(String profile) {
        ObjectNode schema = mapper.createObjectNode();
        schema.put("type", "OBJECT");
        ObjectNode props = schema.putObject("properties");
        props.putObject("summary").put("type", "STRING");
        arrayOfStrings(props, "findings");
        arrayOfStrings(props, "suggestions");
        schema.putArray("required").add("summary");

        List<ChatTurn> turns = List.of(new ChatTurn("user", profile));
        String json = gemini.generateJson(SYSTEM, turns, schema);
        try {
            JsonNode n = mapper.readTree(json);
            return new DataInsightReply(
                    n.path("summary").asText("").trim(),
                    strings(n.path("findings")),
                    strings(n.path("suggestions")));
        } catch (Exception e) {
            log.warn("Could not parse data-lab JSON: {}", json);
            return new DataInsightReply(json, List.of(), List.of());
        }
    }

    private void arrayOfStrings(ObjectNode props, String name) {
        ObjectNode arr = props.putObject(name);
        arr.put("type", "ARRAY");
        arr.putObject("items").put("type", "STRING");
    }

    private List<String> strings(JsonNode arr) {
        List<String> out = new ArrayList<>();
        if (arr.isArray()) arr.forEach(x -> {
            String s = x.asText("").trim();
            if (!s.isBlank()) out.add(s);
        });
        return out;
    }
}
