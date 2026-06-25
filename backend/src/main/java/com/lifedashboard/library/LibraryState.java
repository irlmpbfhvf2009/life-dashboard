package com.lifedashboard.library;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.Instant;

/**
 * Per-user library state (bookmarks + reading progress), stored as one opaque
 * JSON document. Mirrors {@code travel_state} / {@code english_state}: the
 * frontend owns the schema, the backend just persists and serves it so a user's
 * saved books and where-they-left-off follow them across devices.
 */
@Entity
@Table(name = "library_state", uniqueConstraints = @UniqueConstraint(columnNames = "user_id"))
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class LibraryState {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false, unique = true)
    private Long userId;

    @Column(columnDefinition = "text", nullable = false)
    private String state;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;
}
