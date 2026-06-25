package com.lifedashboard.travel;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.Instant;

/**
 * Per-user travel state, stored as one opaque JSON document (trip expenses +
 * exchange rate). Mirrors {@code english_state}: the frontend owns the schema,
 * the backend just persists and serves it so the trip wallet follows the user
 * across devices.
 */
@Entity
@Table(name = "travel_state", uniqueConstraints = @UniqueConstraint(columnNames = "user_id"))
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class TravelState {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false, unique = true)
    private Long userId;

    /** The full state JSON serialized as text. */
    @Column(columnDefinition = "text", nullable = false)
    private String state;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;
}
