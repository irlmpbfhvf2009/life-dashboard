package com.lifedashboard.english;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.Instant;

/**
 * Per-user English-Coach learning state, stored as one opaque JSON document
 * (progress / mistakes / reviews / mastery / streak / mission). The frontend
 * owns the schema; the backend just persists and serves it so the state follows
 * the user across devices.
 */
@Entity
@Table(name = "english_state", uniqueConstraints = @UniqueConstraint(columnNames = "user_id"))
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class EnglishState {

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
