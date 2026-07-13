package com.lifedashboard.ai;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.lifedashboard.ai.dto.ChatTurn;
import com.lifedashboard.ai.dto.NutritionEntryReply;
import com.lifedashboard.ai.dto.NutritionRequest;
import com.lifedashboard.ai.dto.NutritionReviewReply;
import com.lifedashboard.ai.dto.NutritionReviewRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

/**
 * A free AI nutritionist built on {@link AiClient}. Estimates the macros /
 * micronutrients of a logged meal or exercise (text and/or photo), and gives a
 * daily verdict on whether the user hit a balanced intake. Degrades gracefully
 * (503) when no key is configured.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class NutritionService {

    private final AiClient ai;
    private final ObjectMapper mapper = new ObjectMapper();

    public boolean isEnabled() {
        return ai.isEnabled();
    }

    // ---- One logged item (meal or exercise) → structured estimate ----

    public NutritionEntryReply analyze(NutritionRequest req) {
        boolean hasText = req.text() != null && !req.text().isBlank();
        boolean hasImage = req.image() != null && !req.image().isBlank();
        if (!hasText && !hasImage) {
            throw new IllegalArgumentException("請輸入文字或拍一張照片");
        }

        ObjectNode schema = mapper.createObjectNode();
        schema.put("type", "OBJECT");
        ObjectNode props = schema.putObject("properties");
        props.putObject("kind").put("type", "STRING");
        props.putObject("label").put("type", "STRING");
        props.putObject("calories").put("type", "INTEGER");
        props.putObject("protein").put("type", "NUMBER");
        props.putObject("fiber").put("type", "NUMBER");
        props.putObject("carbs").put("type", "NUMBER");
        props.putObject("fat").put("type", "NUMBER");
        ObjectNode kn = props.putObject("keyNutrients");
        kn.put("type", "ARRAY");
        kn.putObject("items").put("type", "STRING");
        props.putObject("note").put("type", "STRING");
        schema.putArray("required").add("kind").add("label").add("calories");

        double weightKg = req.weightKg() != null && req.weightKg() > 0 ? req.weightKg() : 70;

        String system = """
                You are a nutrition analyst. The user logs ONE food item / meal OR ONE exercise,
                by a short text and/or a photo. Estimate its nutrition for an average adult.
                Reply ONLY with the JSON object, all text fields in Traditional Chinese (zh-TW):
                - "kind": "food" if it is something eaten/drunk, "exercise" if it is physical activity.
                - "label": a short name of the item (<= 16 chars).
                - "calories": integer. For food = calories eaten.
                  For exercise = calories burned (positive), estimated with the MET method:
                  kcal = MET × %.1f(kg) × duration(hours). The user's body weight is %.1f kg.
                  Pick a reasonable MET for the activity and its described intensity (e.g. light
                  weightlifting/resting between sets ≈ 3-4 MET, vigorous continuous strength
                  training ≈ 5-6 MET, moderate cardio ≈ 6-7 MET, vigorous cardio ≈ 8-10 MET).
                  If the user mentions a duration (minutes), and especially if they say to
                  exclude rest/break time, use ONLY the actual active/working time they describe
                  for the duration, not the total time at the gym.
                - "protein","fiber","carbs","fat": grams as numbers. All 0 for exercise.
                - "keyNutrients": array of short tags for notable vitamins/minerals present
                  (e.g. ["維生素C","鐵","鈣"]). Empty array for exercise.
                - "note": one short helpful sentence. For exercise, briefly state the MET and
                  active duration you used, e.g. "以中強度重訓 5 MET、實際訓練 70 分鐘估算".
                If a portion size is not given, assume a reasonable average serving.
                If a photo shows several foods, estimate the whole plate as one item.
                """.formatted(weightKg, weightKg);

        String userText = hasText ? req.text().trim() : "請辨識這張照片中的食物並估算營養。";

        String json = hasImage
                ? ai.generateJsonWithImage(system, userText, req.image(), req.mimeType(), schema)
                : ai.generateJson(system, List.of(new ChatTurn("user", userText)), schema);

        try {
            JsonNode n = mapper.readTree(json);
            String kind = "exercise".equalsIgnoreCase(n.path("kind").asText("food")) ? "exercise" : "food";
            return new NutritionEntryReply(
                    kind,
                    text(n, "label", kind.equals("exercise") ? "運動" : "餐點"),
                    n.path("calories").asInt(0),
                    n.path("protein").asDouble(0),
                    n.path("fiber").asDouble(0),
                    n.path("carbs").asDouble(0),
                    n.path("fat").asDouble(0),
                    strings(n.path("keyNutrients")),
                    text(n, "note", ""));
        } catch (Exception e) {
            log.warn("Could not parse nutrition JSON: {}", json);
            return new NutritionEntryReply("food", "餐點", 0, 0, 0, 0, 0, List.of(), "");
        }
    }

    // ---- The whole day → balanced-nutrition verdict ----

    public NutritionReviewReply review(NutritionReviewRequest req) {
        ObjectNode schema = mapper.createObjectNode();
        schema.put("type", "OBJECT");
        ObjectNode props = schema.putObject("properties");
        props.putObject("balanceScore").put("type", "INTEGER");
        props.putObject("verdict").put("type", "STRING");
        ObjectNode lacking = props.putObject("lacking");
        lacking.put("type", "ARRAY");
        ObjectNode items = lacking.putObject("items");
        items.put("type", "OBJECT");
        ObjectNode ip = items.putObject("properties");
        ip.putObject("nutrient").put("type", "STRING");
        ip.putObject("note").put("type", "STRING");
        ObjectNode sug = props.putObject("suggestions");
        sug.put("type", "ARRAY");
        sug.putObject("items").put("type", "STRING");
        props.putObject("calorieNote").put("type", "STRING");
        schema.putArray("required").add("balanceScore").add("verdict");

        int deficit = req.maintenanceCalories() - req.intake() + req.burned();
        String foods = (req.items() == null || req.items().isEmpty()) ? "（今天還沒有紀錄）" : String.join("、", req.items());

        String system = """
                You are a friendly Traditional-Chinese (zh-TW) nutritionist. Judge whether the user
                reached a well-balanced daily intake for an ordinary healthy adult, focusing on
                protein, dietary fibre and vitamins/minerals. Reply ONLY with the JSON object:
                - "balanceScore": integer 0-100 for how balanced today's nutrition is.
                - "verdict": one warm, honest sentence summarising today.
                - "lacking": nutrients they fell short on, each {"nutrient","note"} (note = short why/how much short).
                  If nothing is meaningfully short, return an empty array.
                - "suggestions": 2-4 concrete, easy foods to eat to fill the gaps (each a short phrase).
                - "calorieNote": one sentence about their calorie deficit/surplus and what it means for fat loss.
                Be encouraging but specific. Do not invent foods the user did not eat.
                """;

        String userMsg = """
                今日攝取總結：
                - 體重：%.1f kg
                - 每日消耗 (TDEE)：%d kcal
                - 吃進熱量：%d kcal
                - 運動消耗：%d kcal
                - 熱量赤字：%d kcal（正=赤字/減脂，負=盈餘）
                - 蛋白質：%.0f g
                - 膳食纖維：%.0f g
                - 碳水：%.0f g
                - 脂肪：%.0f g
                今天吃的東西：%s
                """.formatted(req.weightKg(), req.maintenanceCalories(), req.intake(), req.burned(),
                deficit, req.protein(), req.fiber(), req.carbs(), req.fat(), foods);

        String json = ai.generateJson(system, List.of(new ChatTurn("user", userMsg)), schema);
        try {
            JsonNode n = mapper.readTree(json);
            List<NutritionReviewReply.Gap> gaps = new ArrayList<>();
            for (JsonNode g : n.path("lacking")) {
                gaps.add(new NutritionReviewReply.Gap(
                        g.path("nutrient").asText(""), g.path("note").asText("")));
            }
            int score = Math.max(0, Math.min(100, n.path("balanceScore").asInt(0)));
            return new NutritionReviewReply(
                    score,
                    text(n, "verdict", ""),
                    gaps,
                    strings(n.path("suggestions")),
                    text(n, "calorieNote", ""));
        } catch (Exception e) {
            log.warn("Could not parse nutrition review JSON: {}", json);
            return new NutritionReviewReply(0, "暫時無法分析，請稍後再試", List.of(), List.of(), "");
        }
    }

    private String text(JsonNode n, String field, String fallback) {
        String v = n.path(field).asText("").trim();
        return v.isBlank() ? fallback : v;
    }

    private List<String> strings(JsonNode arr) {
        List<String> out = new ArrayList<>();
        if (arr != null && arr.isArray()) {
            for (JsonNode e : arr) {
                String s = e.asText("").trim();
                if (!s.isBlank()) out.add(s);
            }
        }
        return out;
    }
}
