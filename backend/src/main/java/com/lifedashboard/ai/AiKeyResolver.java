package com.lifedashboard.ai;

import com.lifedashboard.security.CurrentUserService;
import com.lifedashboard.user.User;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * Decides which provider / model / key the current request should use:
 * <ol>
 *   <li>the member's own saved provider + key, if any;</li>
 *   <li>otherwise the shared Gemini app key — but only for admins/owner;</li>
 *   <li>otherwise none (regular members must supply their own key).</li>
 * </ol>
 * Kept separate from {@link AiClient} (which depends on it) to avoid a cycle
 * with the key-management service.
 */
@Component
@RequiredArgsConstructor
public class AiKeyResolver {

    private final UserAiKeyRepository repository;
    private final CurrentUserService currentUserService;

    @Value("${app.gemini.api-key:}")
    private String appKey;

    @Value("${app.gemini.model:gemini-2.5-flash}")
    private String appModel;

    /** The effective AI config for the current user, or null when AI is unavailable to them. */
    public AiConfig resolve() {
        User user;
        try {
            user = currentUserService.getCurrentUser();
        } catch (Exception e) {
            return null;
        }
        UserAiKey key = repository.findByUserId(user.getId()).orElse(null);
        if (key != null && key.getApiKey() != null && !key.getApiKey().isBlank()) {
            AiProvider provider = AiProvider.from(key.getProvider());
            String model = (key.getModel() == null || key.getModel().isBlank())
                    ? AiCatalog.defaultModel(provider)
                    : key.getModel().trim();
            return new AiConfig(provider, key.getApiKey().trim(), model, AiCatalog.vision(provider, model));
        }
        // No personal key: only admins/owner fall back to the shared Gemini app key.
        if (Boolean.TRUE.equals(user.getIsAdmin()) && appKey != null && !appKey.isBlank()) {
            return new AiConfig(AiProvider.GEMINI, appKey.trim(), appModel,
                    AiCatalog.vision(AiProvider.GEMINI, appModel));
        }
        return null;
    }

    public boolean available() {
        return resolve() != null;
    }
}
