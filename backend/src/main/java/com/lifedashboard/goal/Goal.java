package com.lifedashboard.goal;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.Instant;
import java.time.LocalDate;

@Entity
@Table(name = "goals", indexes = {
        @Index(name = "idx_goals_user_status", columnList = "user_id, status")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Goal {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(nullable = false, length = 120)
    private String title;

    @Column(columnDefinition = "text")
    private String description;

    /** Target amount to reach (e.g. 100 books, 12 km). */
    @Column(name = "target_value", nullable = false)
    private double targetValue;

    /** Progress so far, clamped to [0, targetValue]. */
    @Column(name = "current_value", nullable = false)
    private double currentValue;

    /** Free-text unit shown next to the numbers (e.g. "本", "km", "次"). */
    @Column(length = 24)
    private String unit;

    @Column(name = "deadline")
    private LocalDate deadline;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private GoalStatus status;

    /** Tailwind tint slug (e.g. "violet"), resolved on the client. */
    @Column(length = 24)
    private String color;

    @Column(name = "sort_order", nullable = false)
    private int sortOrder;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;
}
