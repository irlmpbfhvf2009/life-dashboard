package com.lifedashboard.ai;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.lifedashboard.ai.dto.ChatTurn;
import com.lifedashboard.ai.dto.SpotReply;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

/**
 * Suggests must-see sightseeing spots for a destination via {@link GeminiClient},
 * each tagged with a suggested day so the frontend can drop them into the
 * itinerary. Degrades gracefully (503) when no key is configured.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class SpotSuggestService {

    private final GeminiClient gemini;
    private final ObjectMapper mapper = new ObjectMapper();

    public boolean isEnabled() {
        return gemini.isEnabled();
    }

    public SpotReply suggest(String place, int days) {
        int d = days < 1 ? 3 : Math.min(days, 14);

        ObjectNode schema = mapper.createObjectNode();
        schema.put("type", "OBJECT");
        ObjectNode spots = schema.putObject("properties").putObject("spots");
        spots.put("type", "ARRAY");
        ObjectNode item = spots.putObject("items");
        item.put("type", "OBJECT");
        ObjectNode ip = item.putObject("properties");
        ip.putObject("name").put("type", "STRING");
        ip.putObject("area").put("type", "STRING");
        ip.putObject("reason").put("type", "STRING");
        ip.putObject("day").put("type", "INTEGER");
        item.putArray("required").add("name");
        schema.putArray("required").add("spots");

        String system = """
                You are a travel planner. Suggest must-see spots for a tourist visiting %s for %d day(s).
                Reply IN TRADITIONAL CHINESE. Return ONLY the JSON object with "spots": an array of 5-8 items,
                each with:
                - "name": the place name (you may add the local-language name in parentheses).
                - "area": the district / area it is in.
                - "reason": ONE short sentence on why it is worth visiting.
                - "day": a suggested day number from 1 to %d, grouping nearby places onto the same day.
                Favor iconic, realistic, well-known spots; no duplicates.
                """.formatted(place, d, d);

        String json = gemini.generateJson(system,
                List.of(new ChatTurn("user", "請推薦景點並安排天數。")), schema);
        try {
            JsonNode n = mapper.readTree(json);
            List<SpotReply.Spot> out = new ArrayList<>();
            JsonNode arr = n.path("spots");
            if (arr.isArray()) {
                for (JsonNode s : arr) {
                    String name = s.path("name").asText("").trim();
                    if (name.isBlank()) continue;
                    int day = s.path("day").asInt(1);
                    if (day < 1) day = 1;
                    if (day > d) day = d;
                    out.add(new SpotReply.Spot(
                            name,
                            s.path("area").asText("").trim(),
                            s.path("reason").asText("").trim(),
                            day));
                }
            }
            return new SpotReply(out);
        } catch (Exception e) {
            log.warn("Could not parse spots JSON: {}", json);
            return new SpotReply(List.of());
        }
    }
}
