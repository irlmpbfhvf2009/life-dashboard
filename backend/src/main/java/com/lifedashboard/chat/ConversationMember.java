package com.lifedashboard.chat;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.Instant;

/**
 * A user's membership in a conversation. {@code lastReadAt} marks how far the
 * user has read, so unread counts are messages newer than it. PUBLIC-room
 * membership is created lazily the first time a user opens chat.
 */
@Entity
@Table(name = "conversation_members", uniqueConstraints =
        @UniqueConstraint(name = "uk_member_pair", columnNames = {"conversation_id", "user_id"}),
        indexes = {
                @Index(name = "idx_member_user", columnList = "user_id"),
                @Index(name = "idx_member_conversation", columnList = "conversation_id")
        })
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ConversationMember {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "conversation_id", nullable = false)
    private Long conversationId;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "last_read_at")
    private Instant lastReadAt;

    /** Messages at or before this are hidden from me ("clear history" — per-user). */
    @Column(name = "cleared_at")
    private Instant clearedAt;

    /** Removed from my conversation list ("delete chat"); reappears on a new message.
     *  Nullable in the DB (added via ddl-auto): null is treated as false. */
    @Column(name = "hidden")
    private Boolean hidden;

    @CreationTimestamp
    @Column(name = "joined_at", nullable = false, updatable = false)
    private Instant joinedAt;
}
