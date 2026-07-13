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

    // ---- One submission (may describe several items) → one entry per item ----

    private static final int MAX_ITEMS = 12; // defensive cap against a pathological response

    public List<NutritionEntryReply> analyze(NutritionRequest req) {
        boolean hasText = req.text() != null && !req.text().isBlank();
        boolean hasImage = req.image() != null && !req.image().isBlank();
        if (!hasText && !hasImage) {
            throw new IllegalArgumentException("請輸入文字或拍一張照片");
        }

        ObjectNode itemSchema = mapper.createObjectNode();
        itemSchema.put("type", "OBJECT");
        ObjectNode props = itemSchema.putObject("properties");
        props.putObject("kind").put("type", "STRING");
        props.putObject("label").put("type", "STRING");
        props.putObject("calories").put("type", "INTEGER");
        props.putObject("protein").put("type", "NUMBER");
        props.putObject("fiber").put("type", "NUMBER");
        props.putObject("starch").put("type", "NUMBER");
        props.putObject("sugar").put("type", "NUMBER");
        props.putObject("carbs").put("type", "NUMBER");
        props.putObject("fat").put("type", "NUMBER");
        props.putObject("saturatedFat").put("type", "NUMBER");
        props.putObject("addedSugar").put("type", "NUMBER");
        props.putObject("sodium").put("type", "NUMBER");
        ObjectNode kn = props.putObject("keyNutrients");
        kn.put("type", "ARRAY");
        kn.putObject("items").put("type", "STRING");
        props.putObject("note").put("type", "STRING");
        itemSchema.putArray("required").add("kind").add("label").add("calories");

        ObjectNode schema = mapper.createObjectNode();
        schema.put("type", "ARRAY");
        schema.set("items", itemSchema);

        double weightKg = req.weightKg() != null && req.weightKg() > 0 ? req.weightKg() : 70;

        String system = """
                You are a nutrition analyst. The user logs their food and/or exercise for a moment
                in their day, by a short text and/or a photo. Their message may describe ONE thing
                or SEVERAL distinct things at once (e.g. "早上吃三明治 重訓90分鐘 午餐雞胸肉配豆奶"
                describes four separate loggable items: a breakfast food, a workout, a lunch food,
                and a drink). Split the message into one array entry PER distinct food/meal or
                exercise mentioned — never merge unrelated items into one entry, and never drop
                any item the user mentioned. If only one thing is described, return an array with
                exactly one entry. Estimate nutrition for an average adult.
                Reply ONLY with a JSON array, all text fields in Traditional Chinese (zh-TW). Each
                array entry:
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
                - "protein","fat": total grams as numbers. All 0 for exercise.
                - "carbs": total grams of carbohydrate. All 0 for exercise.
                - "fiber","starch","sugar": grams as numbers that break "carbs" down into its three
                  sources — dietary fibre, starch, and total sugars (fiber+starch+sugar should
                  roughly add up to carbs). All 0 for exercise.
                - "saturatedFat": grams of saturated fat, a subset of "fat". All 0 for exercise.
                - "addedSugar": grams of sugar added during processing/preparation (e.g. in a drink,
                  dessert, sauce, or sweetened food) — NOT sugar naturally occurring in whole foods
                  like plain fruit or milk. 0 if the item has no added sugar, and 0 for exercise.
                - "sodium": milligrams of sodium. Consider salt, sauces, processed/preserved food,
                  and restaurant meals as major sources. All 0 for exercise.
                - "keyNutrients": array of short tags for notable vitamins/minerals present
                  (e.g. ["維生素C","鐵","鈣"]). Empty array for exercise.
                - "note": one short helpful sentence. For exercise, briefly state the MET and
                  active duration you used, e.g. "以中強度重訓 5 MET、實際訓練 70 分鐘估算".
                If a portion size is not given, assume a reasonable average serving.
                If a photo shows one plate with several foods together, that can be one item —
                but if the accompanying text also mentions other separate meals/exercise, still
                give those their own array entries.
                """.formatted(weightKg, weightKg);

        String userText = hasText ? req.text().trim() : "請辨識這張照片中的食物並估算營養。";

        String json = hasImage
                ? ai.generateJsonWithImage(system, userText, req.image(), req.mimeType(), schema)
                : ai.generateJson(system, List.of(new ChatTurn("user", userText)), schema);

        try {
            JsonNode root = mapper.readTree(json);
            List<NutritionEntryReply> out = new ArrayList<>();
            for (JsonNode n : extractItems(root)) {
                if (out.size() >= MAX_ITEMS) break;
                String kind = "exercise".equalsIgnoreCase(n.path("kind").asText("food")) ? "exercise" : "food";
                out.add(new NutritionEntryReply(
                        kind,
                        text(n, "label", kind.equals("exercise") ? "運動" : "餐點"),
                        n.path("calories").asInt(0),
                        n.path("protein").asDouble(0),
                        n.path("fiber").asDouble(0),
                        n.path("starch").asDouble(0),
                        n.path("sugar").asDouble(0),
                        n.path("carbs").asDouble(0),
                        n.path("fat").asDouble(0),
                        n.path("saturatedFat").asDouble(0),
                        n.path("addedSugar").asDouble(0),
                        n.path("sodium").asDouble(0),
                        strings(n.path("keyNutrients")),
                        text(n, "note", "")));
            }
            if (out.isEmpty()) throw new IllegalStateException("no items parsed");
            return out;
        } catch (Exception e) {
            log.warn("Could not parse nutrition JSON: {}", json);
            return List.of(new NutritionEntryReply("food", "餐點", 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, List.of(), ""));
        }
    }

    /** Accepts a raw array, a wrapped {"items":[...]}, or (fallback) a single lone object. */
    private List<JsonNode> extractItems(JsonNode root) {
        List<JsonNode> list = new ArrayList<>();
        if (root.isArray()) {
            root.forEach(list::add);
        } else if (root.path("items").isArray()) {
            root.path("items").forEach(list::add);
        } else if (root.isObject()) {
            list.add(root);
        }
        return list;
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
        ObjectNode excess = props.putObject("excess");
        excess.put("type", "ARRAY");
        ObjectNode eItems = excess.putObject("items");
        eItems.put("type", "OBJECT");
        ObjectNode eip = eItems.putObject("properties");
        eip.putObject("nutrient").put("type", "STRING");
        eip.putObject("note").put("type", "STRING");
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
                protein, dietary fibre and vitamins/minerals — but also flag things they had TOO
                MUCH of: sodium (WHO guideline ≈ 2000mg/day), added sugar (≈ 25g/day), and
                saturated fat (≈ 7% of daily calories ÷ 9 kcal/g). Reply ONLY with the JSON object:
                - "balanceScore": integer 0-100 for how balanced today's nutrition is.
                - "verdict": one warm, honest sentence summarising today.
                - "lacking": nutrients they fell short on, each {"nutrient","note"} (note = short why/how much short).
                  If nothing is meaningfully short, return an empty array.
                - "excess": nutrients they exceeded a healthy daily amount for, each {"nutrient","note"}.
                  If sodium is notably high, the note MUST suggest drinking more water today (help
                  flush excess sodium / offset water retention). If nothing is meaningfully over,
                  return an empty array.
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
                - 澱粉：%.0f g
                - 總糖：%.0f g
                - 碳水（總）：%.0f g
                - 脂肪（總）：%.0f g
                - 飽和脂肪：%.0f g
                - 添加糖：%.0f g
                - 鈉：%.0f mg
                今天吃的東西：%s
                """.formatted(req.weightKg(), req.maintenanceCalories(), req.intake(), req.burned(),
                deficit, req.protein(), req.fiber(), req.starch(), req.sugar(), req.carbs(), req.fat(),
                req.saturatedFat(), req.addedSugar(), req.sodium(), foods);

        String json = ai.generateJson(system, List.of(new ChatTurn("user", userMsg)), schema);
        try {
            JsonNode n = mapper.readTree(json);
            List<NutritionReviewReply.Gap> gaps = new ArrayList<>();
            for (JsonNode g : n.path("lacking")) {
                gaps.add(new NutritionReviewReply.Gap(
                        g.path("nutrient").asText(""), g.path("note").asText("")));
            }
            List<NutritionReviewReply.Gap> excessList = new ArrayList<>();
            for (JsonNode g : n.path("excess")) {
                excessList.add(new NutritionReviewReply.Gap(
                        g.path("nutrient").asText(""), g.path("note").asText("")));
            }
            int score = Math.max(0, Math.min(100, n.path("balanceScore").asInt(0)));
            return new NutritionReviewReply(
                    score,
                    text(n, "verdict", ""),
                    gaps,
                    excessList,
                    strings(n.path("suggestions")),
                    text(n, "calorieNote", ""));
        } catch (Exception e) {
            log.warn("Could not parse nutrition review JSON: {}", json);
            return new NutritionReviewReply(0, "暫時無法分析，請稍後再試", List.of(), List.of(), List.of(), "");
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
