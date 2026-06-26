package com.lifedashboard.chat.dto;

import java.time.Instant;

/**
 * A conversation as shown in the list. {@code name}/{@code photoUrl} are resolved
 * for display (DM → the other participant; GROUP/PUBLIC → the room). {@code
 * otherUserId} is set only for DMs (to open that person's profile).
 */
public record ConversationDto(
        Long id,
        String type,
        String name,
        String photoUrl,
        Long otherUserId,
        int memberCount,
        LastMessage lastMessage,
        long unreadCount,
        Instant lastMessageAt,
        PinnedMessage pinnedMessage
) {
    public record LastMessage(String content, String senderName, Instant createdAt) {}
    public record PinnedMessage(Long id, String preview, String senderName) {}
}
