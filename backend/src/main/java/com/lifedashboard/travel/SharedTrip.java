package com.lifedashboard.travel;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.Instant;

/**
 * A read-only, publicly shareable snapshot of a trip (itinerary + map points,
 * weather, etc.). Owned by a user, addressed by an unguessable {@code token}.
 * The snapshot is stored opaquely as JSON text — the frontend owns the schema,
 * the backend just persists and serves it, exactly like {@code travel_state}.
 *
 * Anyone with the token can read it via {@code GET /api/public/trip/{token}}
 * (no auth); only the owner can create or revoke it.
 */
@Entity
@Table(name = "shared_trip", indexes = @Index(name = "idx_shared_trip_token", columnList = "token", unique = true))
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SharedTrip {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Unguessable public handle (URL-safe). */
    @Column(nullable = false, unique = true, length = 32)
    private String token;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    /** The trip snapshot JSON serialized as text. */
    @Column(columnDefinition = "text", nullable = false)
    private String snapshot;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;
}
