package com.lifedashboard.social;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.Instant;

/**
 * Per-user visibility switches for the social profile. Basic profile (name /
 * photo / joined date) is always visible to friends; every data module defaults
 * to hidden and the owner opts in here. Absence of a row = everything hidden.
 */
@Entity
@Table(name = "social_privacy", uniqueConstraints = @UniqueConstraint(columnNames = "user_id"))
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SocialPrivacy {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false, unique = true)
    private Long userId;

    @Column(name = "share_health", nullable = false)
    private boolean shareHealth;

    @Column(name = "share_mood", nullable = false)
    private boolean shareMood;

    @Column(name = "share_life", nullable = false)
    private boolean shareLife;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;
}
