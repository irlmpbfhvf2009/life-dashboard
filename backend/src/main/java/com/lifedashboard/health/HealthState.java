package com.lifedashboard.health;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.Instant;

/**
 * Per-user health document ("健康減脂") stored as one opaque JSON blob (profile +
 * daily log: water / weight history). The frontend owns the schema; the backend
 * just persists and serves it so the data follows the user across devices. The
 * dated training plan lives separately in {@code plan_state}. Mirrors
 * {@code english_state} / {@code plan_state}.
 */
@Entity
@Table(name = "health_state", uniqueConstraints = @UniqueConstraint(columnNames = "user_id"))
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class HealthState {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false, unique = true)
    private Long userId;

    /** The full health JSON serialized as text. */
    @Column(columnDefinition = "text", nullable = false)
    private String state;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;
}
