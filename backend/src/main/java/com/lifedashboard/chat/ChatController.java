package com.lifedashboard.chat;

import com.lifedashboard.chat.dto.ConversationDto;
import com.lifedashboard.chat.dto.MessageDto;
import com.lifedashboard.common.ApiResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/chat")
@RequiredArgsConstructor
public class ChatController {

    private final ChatService chatService;

    @GetMapping("/conversations")
    public ApiResponse<List<ConversationDto>> conversations() {
        return ApiResponse.ok(chatService.listConversations());
    }

    /** Total unread across all my conversations — drives the launcher badge. */
    @GetMapping("/unread")
    public ApiResponse<Long> unread() {
        return ApiResponse.ok(chatService.totalUnread());
    }

    public record DmRequest(Long userId) {}

    @PostMapping("/conversations/dm")
    public ApiResponse<ConversationDto> createDm(@RequestBody DmRequest body) {
        return ApiResponse.ok(chatService.createOrGetDm(body.userId()));
    }

    public record GroupRequest(String name, List<Long> memberIds) {}

    @PostMapping("/conversations/group")
    public ApiResponse<ConversationDto> createGroup(@RequestBody GroupRequest body) {
        return ApiResponse.ok(chatService.createGroup(body.name(), body.memberIds()));
    }

    public record AddMembersRequest(List<Long> memberIds) {}

    @PostMapping("/conversations/{id}/members")
    public ApiResponse<Void> addMembers(@PathVariable Long id, @RequestBody AddMembersRequest body) {
        chatService.addGroupMembers(id, body.memberIds());
        return ApiResponse.ok();
    }

    @PostMapping("/conversations/{id}/leave")
    public ApiResponse<Void> leave(@PathVariable Long id) {
        chatService.leaveConversation(id);
        return ApiResponse.ok();
    }

    @GetMapping("/conversations/{id}/messages")
    public ApiResponse<List<MessageDto>> messages(
            @PathVariable Long id,
            @RequestParam(required = false) Long beforeId,
            @RequestParam(required = false) Long afterId) {
        return ApiResponse.ok(chatService.getMessages(id, beforeId, afterId));
    }

    /** kind = TEXT (default) | IMAGE | GIF | AUDIO. Attachments carry attachmentUrl.
     *  replyToId quotes another message; forwardedFrom marks a forwarded copy. */
    public record SendRequest(String content, String kind, String attachmentUrl,
                              Long replyToId, String forwardedFrom) {}

    @PostMapping("/conversations/{id}/messages")
    public ApiResponse<MessageDto> send(@PathVariable Long id, @RequestBody SendRequest body) {
        return ApiResponse.ok(chatService.sendMessage(id, body.content(), body.kind(),
                body.attachmentUrl(), body.replyToId(), body.forwardedFrom()));
    }

    public record EditRequest(String content) {}

    @PatchMapping("/conversations/{id}/messages/{messageId}")
    public ApiResponse<MessageDto> edit(@PathVariable Long id, @PathVariable Long messageId,
                                        @RequestBody EditRequest body) {
        return ApiResponse.ok(chatService.editMessage(id, messageId, body.content()));
    }

    public record PinRequest(Long messageId) {}

    @PostMapping("/conversations/{id}/pin")
    public ApiResponse<Void> pin(@PathVariable Long id, @RequestBody PinRequest body) {
        chatService.setPinned(id, body.messageId());
        return ApiResponse.ok();
    }

    @PostMapping("/conversations/{id}/read")
    public ApiResponse<Void> read(@PathVariable Long id) {
        chatService.markRead(id);
        return ApiResponse.ok();
    }

    /** Unsend my own message (removes it for everyone). */
    @DeleteMapping("/conversations/{id}/messages/{messageId}")
    public ApiResponse<Void> recall(@PathVariable Long id, @PathVariable Long messageId) {
        chatService.recallMessage(id, messageId);
        return ApiResponse.ok();
    }

    /** Clear history for me only. */
    @DeleteMapping("/conversations/{id}/messages")
    public ApiResponse<Void> clearHistory(@PathVariable Long id) {
        chatService.clearHistory(id);
        return ApiResponse.ok();
    }

    /** Remove the chat from my list (DM hide / group leave). */
    @DeleteMapping("/conversations/{id}")
    public ApiResponse<Void> deleteChat(@PathVariable Long id) {
        chatService.deleteChat(id);
        return ApiResponse.ok();
    }

    /** readAt = watermark all other members have read past (drives the 2nd tick). */
    public record ReadStateResponse(java.time.Instant readAt) {}

    @GetMapping("/conversations/{id}/read-state")
    public ApiResponse<ReadStateResponse> readState(@PathVariable Long id) {
        return ApiResponse.ok(new ReadStateResponse(chatService.readWatermark(id)));
    }

    /** "Seen by" list for one of my messages (group read receipts). */
    @GetMapping("/conversations/{id}/readers")
    public ApiResponse<List<ChatService.ReaderDto>> readers(
            @PathVariable Long id, @RequestParam Long messageId) {
        return ApiResponse.ok(chatService.messageReaders(id, messageId));
    }
}
