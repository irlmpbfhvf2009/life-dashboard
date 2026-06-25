package com.lifedashboard.chat.dto;

import java.time.Instant;

/** A single message, with the sender's display info denormalized for rendering.
 *  {@code kind} is TEXT/IMAGE/GIF/AUDIO; attachments carry their media in
 *  {@code attachmentUrl} and {@code content} holds text or an optional caption. */
public record MessageDto(
        Long id,
        Long conversationId,
        Long senderId,
        String senderName,
        String senderPhotoUrl,
        String kind,
        String content,
        String attachmentUrl,
        Instant createdAt
) {}
