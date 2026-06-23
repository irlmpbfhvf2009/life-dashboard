package com.lifedashboard;

import com.google.firebase.auth.FirebaseAuth;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Profile;

import static org.mockito.Mockito.mock;

/**
 * Supplies a mock FirebaseAuth in the "test" profile so the context can load
 * without real Google credentials. The real {@code FirebaseConfig} is disabled
 * via {@code @Profile("!test")}.
 */
@TestConfiguration
@Profile("test")
public class TestFirebaseConfig {

    @Bean
    public FirebaseAuth firebaseAuth() {
        return mock(FirebaseAuth.class);
    }
}
