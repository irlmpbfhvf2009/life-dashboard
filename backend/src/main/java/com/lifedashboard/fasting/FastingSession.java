package com.lifedashboard.fasting;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.Instant;

/** One fasting session. endAt == null means the fast is still in progress. */
@Entity
@Table(name = "fasting_records", indexes = {
        @Index(name = "idx_fasting_user_start", columnList = "user_id, start_at")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class FastingSession {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "start_at", nullable = false)
    private Instant startAt;

    /** Null while the fast is active; set when the user ends it. */
    @Column(name = "end_at")
    private Instant endAt;

    /** Target fasting length in hours (e.g. 16 for 16:8). */
    @Column(name = "target_hours", nullable = false)
    private int targetHours;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;
}
