package com.lifedashboard.habit;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.Instant;

@Entity
@Table(name = "habits", indexes = {
        @Index(name = "idx_habits_user_archived", columnList = "user_id, archived")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Habit {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(nullable = false, length = 80)
    private String name;

    /** Optional emoji shown on the habit card. */
    @Column(length = 16)
    private String emoji;

    /** Tailwind tint key (e.g. "emerald"), resolved to colours on the client. */
    @Column(length = 24)
    private String color;

    /** Times per day that count as "done". Defaults to 1. */
    @Column(name = "target_per_day", nullable = false)
    private int targetPerDay;

    @Column(name = "sort_order", nullable = false)
    private int sortOrder;

    @Column(nullable = false)
    private boolean archived;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;
}
