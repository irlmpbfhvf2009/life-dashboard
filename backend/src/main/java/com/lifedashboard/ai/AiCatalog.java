package com.lifedashboard.ai;

import java.util.List;

/**
 * The curated list of providers + models shown in the settings picker, with a
 * vision flag per model (so the UI can hide the camera for text-only models).
 * Members may also type a custom model id; unknown models are treated as
 * text-only. Model ids change over time — this is a best-effort default set.
 */
public final class AiCatalog {

    public record Model(String id, String label, boolean vision) {}

    public record ProviderInfo(String id, String label, boolean freeTier, List<Model> models) {}

    public static final List<ProviderInfo> PROVIDERS = List.of(
            new ProviderInfo("GEMINI", "Google Gemini", true, List.of(
                    new Model("gemini-2.5-flash", "2.5 Flash（推薦・免費・可拍照）", true),
                    new Model("gemini-2.5-pro", "2.5 Pro（更聰明・免費額度較少）", true),
                    new Model("gemini-2.5-flash-lite", "2.5 Flash-Lite（最省）", true))),
            new ProviderInfo("OPENAI", "OpenAI GPT", false, List.of(
                    new Model("gpt-4o-mini", "GPT-4o mini（便宜・可拍照）", true),
                    new Model("gpt-4o", "GPT-4o（品質高・可拍照）", true))),
            new ProviderInfo("ANTHROPIC", "Anthropic Claude", false, List.of(
                    new Model("claude-haiku-4-5-20251001", "Claude Haiku 4.5（快・可拍照）", true),
                    new Model("claude-sonnet-5", "Claude Sonnet 5（品質高・可拍照）", true))),
            new ProviderInfo("DEEPSEEK", "DeepSeek", false, List.of(
                    new Model("deepseek-chat", "DeepSeek Chat（極便宜）", false))),
            new ProviderInfo("GROQ", "Groq", true, List.of(
                    new Model("llama-3.3-70b-versatile", "Llama 3.3 70B（快・免費層）", false))),
            new ProviderInfo("MISTRAL", "Mistral", true, List.of(
                    new Model("mistral-small-latest", "Mistral Small（免費層）", false),
                    new Model("pixtral-12b", "Pixtral（可拍照）", true)))
    );

    /** The first (recommended) model for a provider. */
    public static String defaultModel(AiProvider p) {
        return PROVIDERS.stream()
                .filter(x -> x.id().equals(p.name()))
                .findFirst()
                .map(x -> x.models().get(0).id())
                .orElse("gemini-2.5-flash");
    }

    /** Whether a known model supports image input; unknown/custom → false. */
    public static boolean vision(AiProvider p, String model) {
        return PROVIDERS.stream()
                .filter(x -> x.id().equals(p.name()))
                .flatMap(x -> x.models().stream())
                .filter(m -> m.id().equals(model))
                .findFirst()
                .map(Model::vision)
                .orElse(false);
    }

    private AiCatalog() {}
}
