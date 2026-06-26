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

    /** kind = TEXT (default) | IMAGE | GIF | AUDIO. Attachments carry attachmentUrl. */
    public record SendRequest(String content, String kind, String attachmentUrl) {}

    @PostMapping("/conversations/{id}/messages")
    public ApiResponse<MessageDto> send(@PathVariable Long id, @RequestBody SendRequest body) {
        return ApiResponse.ok(chatService.sendMessage(id, body.content(), body.kind(), body.attachmentUrl()));
    }

    @PostMapping("/conversations/{id}/read")
    public ApiResponse<Void> read(@PathVariable Long id) {
        chatService.markRead(id);
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
