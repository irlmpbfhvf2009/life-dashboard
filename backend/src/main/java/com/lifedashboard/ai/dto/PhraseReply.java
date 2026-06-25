package com.lifedashboard.ai.dto;

/**
 * One Chinese→foreign travel-phrase translation, structured so the frontend can
 * show the native script, a romanized pronunciation, a literal back-translation
 * (sanity check), a politer variant and a short usage tip separately.
 * Language-agnostic — the target language is chosen per request.
 */
public record PhraseReply(
        /** The natural spoken phrase in the target language's native script. */
        String nativeText,
        /** Romanized pronunciation, friendly for a Chinese speaker to read aloud. */
        String pronunciation,
        /** Literal back-translation into Traditional Chinese, so the user can sanity-check. */
        String literal,
        /** A more polite variant, useful with strangers/staff. */
        String polite,
        /** A short cultural/usage tip in Traditional Chinese (may be empty). */
        String tip
) {
}
