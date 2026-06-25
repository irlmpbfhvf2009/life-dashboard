package com.lifedashboard.push;

import com.google.api.core.ApiFuture;
import com.google.api.core.ApiFutureCallback;
import com.google.api.core.ApiFutures;
import com.google.firebase.messaging.*;
import com.lifedashboard.security.CurrentUserService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.Executor;
import java.util.concurrent.Executors;

/**
 * Web Push (FCM) for chat. Browsers register a token via {@link #register}; when a
 * message is posted we fan it out to every recipient's tokens. Delivery is
 * fire-and-forget (async, never blocks the send response) and self-healing: tokens
 * that FCM reports as gone are pruned. If Firebase isn't configured (e.g. local dev
 * / tests) this degrades to a no-op.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class PushService {

    private final ObjectProvider<FirebaseMessaging> messagingProvider;
    private final PushTokenRepository tokenRepository;
    private final CurrentUserService currentUserService;

    private final Executor pruneExecutor = Executors.newSingleThreadExecutor(r -> {
        Thread t = new Thread(r, "push-prune");
        t.setDaemon(true);
        return t;
    });

    /** Register (or re-home) the caller's Web Push token. */
    @Transactional
    public void register(String token) {
        if (token == null || token.isBlank()) return;
        Long me = currentUserService.getCurrentUserId();
        PushToken existing = tokenRepository.findByToken(token).orElse(null);
        if (existing == null) {
            tokenRepository.save(PushToken.builder().userId(me).token(token).build());
        } else if (!existing.getUserId().equals(me)) {
            existing.setUserId(me);
            tokenRepository.save(existing);
        }
    }

    @Transactional
    public void unregister(String token) {
        if (token != null && !token.isBlank()) tokenRepository.deleteByToken(token);
    }

    /**
     * Deliver a notification to the given users' devices.
     *
     * @param userIds recipients (the sender should already be excluded)
     * @param title   notification title (e.g. conversation / sender name)
     * @param body    short preview text
     * @param data    extra key/value payload for the SW click handler
     */
    @Transactional(readOnly = true)
    public void sendToUsers(List<Long> userIds, String title, String body, Map<String, String> data) {
        FirebaseMessaging messaging = messagingProvider.getIfAvailable();
        if (messaging == null || userIds == null || userIds.isEmpty()) return;

        List<PushToken> tokens = tokenRepository.findByUserIdIn(userIds);
        if (tokens.isEmpty()) return;
        List<String> tokenStrings = tokens.stream().map(PushToken::getToken).toList();

        MulticastMessage message = MulticastMessage.builder()
                .addAllTokens(tokenStrings)
                .setNotification(Notification.builder().setTitle(title).setBody(body).build())
                .putAllData(data == null ? Map.of() : data)
                .setWebpushConfig(WebpushConfig.builder()
                        .setFcmOptions(WebpushFcmOptions.withLink("/"))
                        .build())
                .build();

        try {
            ApiFuture<BatchResponse> future = messaging.sendEachForMulticastAsync(message);
            ApiFutures.addCallback(future, new ApiFutureCallback<>() {
                @Override
                public void onFailure(Throwable t) {
                    log.warn("Push fan-out failed: {}", t.getMessage());
                }

                @Override
                public void onSuccess(BatchResponse response) {
                    pruneInvalid(response, tokenStrings);
                }
            }, pruneExecutor);
        } catch (Exception e) {
            log.warn("Push send threw: {}", e.getMessage());
        }
    }

    /** Drop tokens FCM no longer recognizes so we stop spending on dead devices. */
    private void pruneInvalid(BatchResponse response, List<String> tokenStrings) {
        List<SendResponse> responses = response.getResponses();
        List<String> dead = new ArrayList<>();
        for (int i = 0; i < responses.size(); i++) {
            SendResponse r = responses.get(i);
            if (r.isSuccessful()) continue;
            MessagingErrorCode code = r.getException() == null ? null : r.getException().getMessagingErrorCode();
            if (code == MessagingErrorCode.UNREGISTERED || code == MessagingErrorCode.INVALID_ARGUMENT) {
                dead.add(tokenStrings.get(i));
            }
        }
        for (String token : dead) {
            try {
                tokenRepository.deleteByToken(token);
            } catch (Exception ignored) {
                // best-effort cleanup
            }
        }
    }
}
