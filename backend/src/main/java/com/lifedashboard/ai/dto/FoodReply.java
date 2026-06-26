package com.lifedashboard.ai.dto;

import java.util.List;

/** AI local-food recommendations. */
public record FoodReply(List<Dish> dishes) {

    /**
     * @param name       dish name in Chinese (may include a Latin/English name in parentheses)
     * @param nativeName the dish name in the local language — for the "speak to vendor" button
     * @param category   a short tag, e.g. 小吃 / 麵食 / 甜點 / 海鮮
     * @param where      where to find it, e.g. a market, street or kind of shop
     * @param reason     one short sentence on why it is worth trying
     */
    public record Dish(String name, String nativeName, String category, String where, String reason) {}
}
