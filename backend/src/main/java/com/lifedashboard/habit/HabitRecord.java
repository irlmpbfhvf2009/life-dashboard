package com.lifedashboard.habit;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.Instant;
import java.time.LocalDate;

/** One check-in row per habit per day (count = how many times done that day). */
@Entity
@Table(name = "habit_records", uniqueConstraints = {
        @UniqueConstraint(name = "uk_habit_records_habit_date", columnNames = {"habit_id", "date"})
}, indexes = {
        @Index(name = "idx_habit_records_user_date", columnList = "user_id, date")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class HabitRecord {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "habit_id", nullable = false)
    private Long habitId;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(nullable = false)
    private LocalDate date;

    @Column(nullable = false)
    private int count;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;
}
