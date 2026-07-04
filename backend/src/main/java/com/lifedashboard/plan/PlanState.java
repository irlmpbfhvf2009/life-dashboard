package com.lifedashboard.plan;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.Instant;

/**
 * Per-user training/diet program ("減脂課表") stored as one opaque JSON document
 * (the dated day-by-day plan plus completion checkboxes). The frontend owns the
 * schema; the backend just persists and serves it so the plan follows the user
 * across devices. Mirrors {@code english_state} / {@code pet_state}.
 */
@Entity
@Table(name = "plan_state", uniqueConstraints = @UniqueConstraint(columnNames = "user_id"))
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PlanState {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false, unique = true)
    private Long userId;

    /** The full plan JSON serialized as text. */
    @Column(columnDefinition = "text", nullable = false)
    private String state;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;
}
