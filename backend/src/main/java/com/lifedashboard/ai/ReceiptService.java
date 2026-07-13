package com.lifedashboard.ai;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.lifedashboard.ai.dto.ReceiptReply;
import com.lifedashboard.ai.dto.ReceiptRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

/**
 * Reads a receipt photo via {@link AiClient}'s vision call and returns
 * structured expense fields the travel wallet can pre-fill. Degrades gracefully
 * (503) when no key is configured.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ReceiptService {

    private final AiClient ai;
    private final ObjectMapper mapper = new ObjectMapper();

    public boolean isEnabled() {
        return ai.isEnabled();
    }

    public ReceiptReply scan(ReceiptRequest req) {
        ObjectNode schema = mapper.createObjectNode();
        schema.put("type", "OBJECT");
        ObjectNode props = schema.putObject("properties");
        props.putObject("amount").put("type", "NUMBER");
        props.putObject("currency").put("type", "STRING");
        props.putObject("category").put("type", "STRING");
        props.putObject("note").put("type", "STRING");
        props.putObject("date").put("type", "STRING");
        schema.putArray("required").add("amount");

        String cats = (req.categories() == null || req.categories().isEmpty())
                ? "餐飲,交通,購物,住宿,娛樂,其他"
                : String.join(",", req.categories());
        String fallbackCcy = req.currency() == null ? "" : req.currency();

        String system = """
                You read a photo of a receipt and extract structured data for a travel expense.
                Return ONLY the JSON object:
                - "amount": the TOTAL amount paid, as a number (no currency symbol, no thousands separators).
                - "currency": the 3-letter currency code. If unclear, use "%s".
                - "category": choose the single best fit from this list: %s.
                - "note": a short merchant name or description (<= 20 chars), in the receipt's language.
                - "date": the receipt date as yyyy-MM-dd if visible, otherwise "".
                If you cannot read a total, set amount to 0.
                """.formatted(fallbackCcy, cats);

        String json = ai.generateJsonWithImage(system, "請辨識這張收據並擷取金額、幣別、分類。",
                req.image(), req.mimeType(), schema);
        try {
            JsonNode n = mapper.readTree(json);
            return new ReceiptReply(
                    n.path("amount").asDouble(0),
                    text(n, "currency", fallbackCcy),
                    text(n, "category", "其他"),
                    text(n, "note", ""),
                    text(n, "date", ""));
        } catch (Exception e) {
            log.warn("Could not parse receipt JSON: {}", json);
            return new ReceiptReply(0, fallbackCcy, "其他", "", "");
        }
    }

    private String text(JsonNode n, String field, String fallback) {
        String v = n.path(field).asText("").trim();
        return v.isBlank() ? fallback : v;
    }
}
