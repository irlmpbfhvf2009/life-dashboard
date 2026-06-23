package com.lifedashboard.config;

import com.google.auth.oauth2.GoogleCredentials;
import com.google.firebase.FirebaseApp;
import com.google.firebase.FirebaseOptions;
import com.google.firebase.auth.FirebaseAuth;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.util.StringUtils;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;

/**
 * Initializes the Firebase Admin SDK used to verify Firebase ID tokens
 * sent by the frontend.
 *
 * The service account credentials are provided as a single JSON string via the
 * FIREBASE_SERVICE_ACCOUNT_JSON environment variable. Nothing is written to disk
 * and no private key is ever hard-coded.
 *
 * If no service account JSON is provided (e.g. local dev without Firebase), the
 * app falls back to Application Default Credentials so it can still boot.
 */
@Slf4j
@Configuration
@Profile("!test")
public class FirebaseConfig {

    @Value("${app.firebase.project-id}")
    private String projectId;

    @Value("${app.firebase.service-account-json:}")
    private String serviceAccountJson;

    @Bean
    public FirebaseApp firebaseApp() throws IOException {
        if (!FirebaseApp.getApps().isEmpty()) {
            return FirebaseApp.getInstance();
        }

        GoogleCredentials credentials;
        if (StringUtils.hasText(serviceAccountJson)) {
            credentials = GoogleCredentials.fromStream(
                    new ByteArrayInputStream(serviceAccountJson.getBytes(StandardCharsets.UTF_8)));
            log.info("Firebase initialized with service account JSON from environment.");
        } else {
            // Falls back to GOOGLE_APPLICATION_CREDENTIALS / workload identity.
            credentials = GoogleCredentials.getApplicationDefault();
            log.warn("FIREBASE_SERVICE_ACCOUNT_JSON not set. Falling back to Application Default Credentials.");
        }

        FirebaseOptions options = FirebaseOptions.builder()
                .setCredentials(credentials)
                .setProjectId(projectId)
                .build();

        return FirebaseApp.initializeApp(options);
    }

    @Bean
    public FirebaseAuth firebaseAuth(FirebaseApp firebaseApp) {
        return FirebaseAuth.getInstance(firebaseApp);
    }
}
