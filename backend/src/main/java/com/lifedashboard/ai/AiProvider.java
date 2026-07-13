package com.lifedashboard.ai;

/**
 * A supported AI provider and how to talk to it. Most providers speak the
 * OpenAI Chat Completions dialect, so one code path (Style.OPENAI) covers
 * OpenAI, DeepSeek, Groq and Mistral — only the base URL and model differ.
 */
public enum AiProvider {
    GEMINI(Style.GEMINI, "https://generativelanguage.googleapis.com/v1beta"),
    OPENAI(Style.OPENAI, "https://api.openai.com/v1"),
    ANTHROPIC(Style.ANTHROPIC, "https://api.anthropic.com/v1"),
    DEEPSEEK(Style.OPENAI, "https://api.deepseek.com/v1"),
    GROQ(Style.OPENAI, "https://api.groq.com/openai/v1"),
    MISTRAL(Style.OPENAI, "https://api.mistral.ai/v1");

    public enum Style { GEMINI, OPENAI, ANTHROPIC }

    public final Style style;
    public final String baseUrl;

    AiProvider(Style style, String baseUrl) {
        this.style = style;
        this.baseUrl = baseUrl;
    }

    /** Parse a stored provider id, defaulting to GEMINI when unknown/blank. */
    public static AiProvider from(String s) {
        if (s == null || s.isBlank()) return GEMINI;
        try {
            return valueOf(s.trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            return GEMINI;
        }
    }
}
