package com.lifedashboard.pet;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.Instant;

/**
 * Per-user virtual-pet state stored as one opaque JSON document (enabled,
 * animal, name, accessory, level, xp, mood, last active). The frontend owns the
 * schema; the backend persists it so the pet follows the user across devices.
 */
@Entity
@Table(name = "pet_state", uniqueConstraints = @UniqueConstraint(columnNames = "user_id"))
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PetState {

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
