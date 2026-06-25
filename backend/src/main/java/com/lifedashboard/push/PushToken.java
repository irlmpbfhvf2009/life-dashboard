package com.lifedashboard.push;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.Instant;

/** A Web Push (FCM) registration token for one of a user's devices/browsers.
 *  One token belongs to one user; the same physical device re-registering after a
 *  different login simply reassigns the row to the new user. */
@Entity
@Table(name = "push_tokens", uniqueConstraints = {
        @UniqueConstraint(name = "uq_push_token", columnNames = "token")
}, indexes = {
        @Index(name = "idx_push_user", columnList = "user_id")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PushToken {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(columnDefinition = "text", nullable = false)
    private String token;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;
}
