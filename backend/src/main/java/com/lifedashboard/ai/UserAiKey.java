package com.lifedashboard.ai;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.Instant;

/**
 * A member's own Gemini API key. When present, all in-app AI runs on this key
 * instead of the shared app key — so each member's usage is billed to their own
 * Google account. One row per user.
 */
@Entity
@Table(name = "user_ai_key", indexes = {
        @Index(name = "idx_user_ai_key_user", columnList = "user_id", unique = true)
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UserAiKey {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false, unique = true)
    private Long userId;

    @Column(name = "api_key", columnDefinition = "text")
    private String apiKey;

    /** Provider id (GEMINI / OPENAI / ANTHROPIC / DEEPSEEK / GROQ / MISTRAL). Null = GEMINI. */
    @Column(name = "provider", length = 32)
    private String provider;

    /** Chosen model id; null = the provider's default model. */
    @Column(name = "model", length = 128)
    private String model;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private Instant updatedAt;
}
