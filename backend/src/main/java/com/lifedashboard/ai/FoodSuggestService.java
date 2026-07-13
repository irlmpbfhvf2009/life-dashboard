package com.lifedashboard.ai;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.lifedashboard.ai.dto.ChatTurn;
import com.lifedashboard.ai.dto.FoodReply;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

/**
 * Suggests must-try local dishes for a destination via {@link AiClient}. Each
 * dish carries a local-language name so the frontend can speak it to a vendor with
 * the same TTS used elsewhere in the travel module. Degrades gracefully (503) when
 * no key is configured.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class FoodSuggestService {

    private final AiClient ai;
    private final ObjectMapper mapper = new ObjectMapper();

    public boolean isEnabled() {
        return ai.isEnabled();
    }

    public FoodReply suggest(String place) {
        ObjectNode schema = mapper.createObjectNode();
        schema.put("type", "OBJECT");
        ObjectNode dishes = schema.putObject("properties").putObject("dishes");
        dishes.put("type", "ARRAY");
        ObjectNode item = dishes.putObject("items");
        item.put("type", "OBJECT");
        ObjectNode ip = item.putObject("properties");
        ip.putObject("name").put("type", "STRING");
        ip.putObject("nativeName").put("type", "STRING");
        ip.putObject("category").put("type", "STRING");
        ip.putObject("where").put("type", "STRING");
        ip.putObject("reason").put("type", "STRING");
        item.putArray("required").add("name").add("nativeName");
        schema.putArray("required").add("dishes");

        String system = """
                You are a local food guide. Recommend the must-try local dishes, snacks and drinks
                for a tourist visiting %s.
                Reply IN TRADITIONAL CHINESE. Return ONLY the JSON object with "dishes": an array of
                6 to 8 items, each with:
                - "name": the dish name in Chinese (you may add an English name in parentheses).
                - "nativeName": the dish name written in the LOCAL language exactly as a vendor would
                  read it, so a traveller can show or say it. For Taiwan use Traditional Chinese.
                - "category": a short tag such as 小吃 / 麵食 / 飯食 / 海鮮 / 甜點 / 飲料.
                - "where": where to find it — a famous market, street, district or kind of shop.
                - "reason": ONE short sentence on why it is worth trying.
                Rules: iconic and genuinely local dishes only; no duplicates; cover a mix of categories.
                """.formatted(place);

        String json = ai.generateJson(system,
                List.of(new ChatTurn("user", "請推薦在地必吃美食。")), schema);
        try {
            JsonNode n = mapper.readTree(json);
            List<FoodReply.Dish> out = new ArrayList<>();
            JsonNode arr = n.path("dishes");
            if (arr.isArray()) {
                for (JsonNode s : arr) {
                    String name = s.path("name").asText("").trim();
                    if (name.isBlank()) continue;
                    out.add(new FoodReply.Dish(
                            name,
                            s.path("nativeName").asText("").trim(),
                            s.path("category").asText("").trim(),
                            s.path("where").asText("").trim(),
                            s.path("reason").asText("").trim()));
                }
            }
            return new FoodReply(out);
        } catch (Exception e) {
            log.warn("Could not parse food JSON: {}", json);
            return new FoodReply(List.of());
        }
    }
}
