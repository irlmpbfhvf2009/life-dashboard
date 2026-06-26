package com.lifedashboard.chat;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.Instant;

/** A single message posted to a conversation. */
@Entity
@Table(name = "chat_messages", indexes = {
        @Index(name = "idx_message_conversation", columnList = "conversation_id, id")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ChatMessage {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "conversation_id", nullable = false)
    private Long conversationId;

    @Column(name = "sender_id", nullable = false)
    private Long senderId;

    /** TEXT for plain messages; IMAGE/GIF/AUDIO carry their media in attachmentUrl.
     *  Nullable in the DB (added later via ddl-auto): null is treated as TEXT. */
    @Enumerated(EnumType.STRING)
    @Column(length = 16)
    private MessageKind kind;

    /** Download URL of the attached image / gif / audio, or null for text. */
    @Column(name = "attachment_url", columnDefinition = "text")
    private String attachmentUrl;

    /** Text body, or an optional caption for attachments (may be empty). */
    @Column(columnDefinition = "text", nullable = false)
    private String content;

    /** The message this one replies to (quoted), or null. */
    @Column(name = "reply_to_id")
    private Long replyToId;

    /** Set when the message has been edited (shows an "edited" marker). */
    @Column(name = "edited_at")
    private Instant editedAt;

    /** Original sender's name when this message was forwarded, else null. */
    @Column(name = "forwarded_from", length = 120)
    private String forwardedFrom;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;
}
