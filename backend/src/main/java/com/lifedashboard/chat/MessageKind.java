package com.lifedashboard.chat;

/** What a chat message carries. Attachments (IMAGE/GIF/AUDIO) keep their media URL
 *  in {@code attachmentUrl}; {@code content} is the text (or an optional caption). */
public enum MessageKind {
    TEXT, IMAGE, GIF, AUDIO
}
