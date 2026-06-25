package com.lifedashboard.chat;

import org.springframework.data.jpa.repository.JpaRepository;

import java.time.Instant;
import java.util.List;

public interface ChatMessageRepository extends JpaRepository<ChatMessage, Long> {

    /** Newest page of a conversation (descending — caller reverses to chronological). */
    List<ChatMessage> findTop50ByConversationIdOrderByIdDesc(Long conversationId);

    /** Older page before a cursor id (for scroll-back). */
    List<ChatMessage> findTop50ByConversationIdAndIdLessThanOrderByIdDesc(Long conversationId, Long beforeId);

    /** Messages newer than a cursor id, chronological (for incremental polling). */
    List<ChatMessage> findByConversationIdAndIdGreaterThanOrderByIdAsc(Long conversationId, Long afterId);

    ChatMessage findFirstByConversationIdOrderByIdDesc(Long conversationId);

    /** Unread = messages after the user's lastReadAt that they did not send. */
    long countByConversationIdAndCreatedAtAfterAndSenderIdNot(Long conversationId, Instant after, Long senderId);
}
