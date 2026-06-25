package com.lifedashboard.chat;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.Instant;

/**
 * A chat thread: a 1-on-1 DM, a named group, or the single PUBLIC room. Members
 * are tracked in {@link ConversationMember}. {@code lastMessageAt} is bumped on
 * every new message so the conversation list can sort by recent activity without
 * a join. {@code name} is only meaningful for GROUP / PUBLIC (DM names resolve to
 * the other participant at read time).
 */
@Entity
@Table(name = "conversations", indexes = {
        @Index(name = "idx_conversation_type", columnList = "type")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Conversation {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private ConversationType type;

    @Column(length = 120)
    private String name;

    @Column(name = "created_by")
    private Long createdBy;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    /** Time of the most recent message (or creation time). Drives list ordering. */
    @Column(name = "last_message_at", nullable = false)
    private Instant lastMessageAt;
}
