package com.lifedashboard.ai;

import com.lifedashboard.ai.dto.AiKeyRequest;
import com.lifedashboard.ai.dto.AiKeyStatus;
import com.lifedashboard.security.CurrentUserService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Lets a member store / clear their own AI provider + model + key. Saving
 * verifies the key with a tiny live call so a wrong paste is caught immediately.
 * The full key is never returned to the client — only a masked hint.
 */
@Service
@RequiredArgsConstructor
public class AiKeyService {

    private final UserAiKeyRepository repository;
    private final CurrentUserService currentUserService;
    private final AiClient ai;
    private final AiKeyResolver resolver;

    @Transactional(readOnly = true)
    public AiKeyStatus status() {
        Long userId = currentUserService.getCurrentUserId();
        UserAiKey row = repository.findByUserId(userId).orElse(null);
        boolean has = row != null && row.getApiKey() != null && !row.getApiKey().isBlank();
        AiConfig cfg = resolver.resolve();
        String provider = cfg != null ? cfg.provider().name() : (has ? row.getProvider() : AiProvider.GEMINI.name());
        String model = cfg != null ? cfg.model() : null;
        boolean vision = cfg != null && cfg.vision();
        return new AiKeyStatus(
                has,
                provider,
                model,
                has ? mask(row.getApiKey()) : null,
                cfg != null,
                !has && cfg != null,
                vision);
    }

    @Transactional
    public void save(AiKeyRequest req) {
        String key = req.apiKey() == null ? "" : req.apiKey().trim();
        if (key.isBlank()) {
            throw new IllegalArgumentException("請輸入 API 金鑰");
        }
        AiProvider provider = AiProvider.from(req.provider());
        String model = (req.model() == null || req.model().isBlank())
                ? AiCatalog.defaultModel(provider)
                : req.model().trim();
        if (!ai.validate(provider, key, model)) {
            throw new IllegalArgumentException("金鑰或模型無效、無法連線，請確認後再試一次");
        }
        Long userId = currentUserService.getCurrentUserId();
        UserAiKey entity = repository.findByUserId(userId)
                .orElseGet(() -> UserAiKey.builder().userId(userId).build());
        entity.setProvider(provider.name());
        entity.setModel(model);
        entity.setApiKey(key);
        repository.save(entity);
    }

    @Transactional
    public void delete() {
        repository.deleteByUserId(currentUserService.getCurrentUserId());
    }

    private String mask(String key) {
        String k = key.trim();
        return k.length() <= 4 ? "••••" : "••••••" + k.substring(k.length() - 4);
    }
}
