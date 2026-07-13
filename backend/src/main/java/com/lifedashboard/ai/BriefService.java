package com.lifedashboard.ai;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.lifedashboard.ai.dto.BriefReply;
import com.lifedashboard.ai.dto.ChatTurn;
import com.lifedashboard.dashboard.DashboardService;
import com.lifedashboard.dashboard.dto.DashboardDto;
import com.lifedashboard.weight.dto.WeightDto;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

/**
 * Generates a natural-language daily brief for the home command center from the
 * user's real dashboard numbers, via {@link AiClient}. Degrades the same way
 * as the other AI features: a missing key throws {@link
 * com.lifedashboard.common.exception.ServiceUnavailableException} (503) and the
 * frontend falls back to its rule-based brief.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class BriefService {

    private final AiClient ai;
    private final DashboardService dashboardService;
    private final ObjectMapper mapper = new ObjectMapper();

    private static final String SYSTEM = """
            You are a warm, concise personal assistant for a private life-OS dashboard.
            You receive a compact snapshot of the user's day (todos, spending, weight trend,
            mood, recent notes). Reply IN TRADITIONAL CHINESE (zh-TW) with:
            - "brief": ONE short sentence summarising today's state in a friendly tone.
            - "suggestion": ONE short, concrete, encouraging suggestion for what to focus on next.
            - "insights": 2-4 items, each with a short "title" (2-6 chars, e.g. 待辦/體重/心情/財務)
              and a "text" (one sentence, specific and grounded in the numbers given).
            Be specific, reference the actual numbers, never invent data you were not given,
            and keep every string under ~40 Chinese characters. Output the JSON object only.
            """;

    public boolean isEnabled() {
        return ai.isEnabled();
    }

    public BriefReply generate() {
        DashboardDto d = dashboardService.getDashboard();
        String snapshot = buildSnapshot(d);

        ObjectNode schema = mapper.createObjectNode();
        schema.put("type", "OBJECT");
        ObjectNode props = schema.putObject("properties");
        props.putObject("brief").put("type", "STRING");
        props.putObject("suggestion").put("type", "STRING");
        ObjectNode insights = props.putObject("insights");
        insights.put("type", "ARRAY");
        ObjectNode items = insights.putObject("items");
        items.put("type", "OBJECT");
        ObjectNode iprops = items.putObject("properties");
        iprops.putObject("title").put("type", "STRING");
        iprops.putObject("text").put("type", "STRING");
        schema.putArray("required").add("brief").add("suggestion");

        String json = ai.generateJson(SYSTEM, List.of(new ChatTurn("user", snapshot)), schema);
        try {
            JsonNode n = mapper.readTree(json);
            List<BriefReply.BriefInsight> list = new ArrayList<>();
            JsonNode arr = n.path("insights");
            if (arr.isArray()) {
                for (JsonNode it : arr) {
                    String title = it.path("title").asText("").trim();
                    String text = it.path("text").asText("").trim();
                    if (!title.isBlank() && !text.isBlank()) list.add(new BriefReply.BriefInsight(title, text));
                }
            }
            return new BriefReply(
                    n.path("brief").asText("").trim(),
                    n.path("suggestion").asText("").trim(),
                    list);
        } catch (Exception e) {
            log.warn("Could not parse brief JSON: {}", json);
            return new BriefReply(json, "", List.of());
        }
    }

    /** Compact, model-friendly summary of the user's day. */
    private String buildSnapshot(DashboardDto d) {
        StringBuilder sb = new StringBuilder();
        long total = d.todayTodoCount() + d.todayDoneCount();
        sb.append("今日待辦：共 ").append(total).append(" 件，已完成 ").append(d.todayDoneCount()).append(" 件。\n");

        BigDecimal expense = d.monthExpenseTotal() != null ? d.monthExpenseTotal() : BigDecimal.ZERO;
        sb.append("本月支出：NT$").append(expense.toPlainString()).append("。\n");

        List<WeightDto> w = d.weekWeightTrend();
        if (w != null && !w.isEmpty()) {
            BigDecimal first = w.get(0).weight();
            BigDecimal last = w.get(w.size() - 1).weight();
            sb.append("近 7 天體重：最新 ").append(last.toPlainString()).append(" kg");
            if (w.size() >= 2) {
                BigDecimal change = last.subtract(first);
                sb.append("，變化 ").append(change.signum() >= 0 ? "+" : "").append(change.toPlainString()).append(" kg");
            }
            sb.append("。\n");
        } else {
            sb.append("近 7 天體重：尚無紀錄。\n");
        }

        if (d.recentMoods() != null && !d.recentMoods().isEmpty()) {
            double avg = d.recentMoods().stream()
                    .filter(m -> m.moodScore() != null)
                    .mapToInt(m -> m.moodScore())
                    .average().orElse(0);
            sb.append("近期心情：平均 ").append(String.format("%.1f", avg)).append("/5。\n");
        } else {
            sb.append("近期心情：尚無紀錄。\n");
        }

        int notes = d.recentNotes() != null ? d.recentNotes().size() : 0;
        sb.append("最近筆記：").append(notes).append(" 篇。");
        return sb.toString();
    }
}
