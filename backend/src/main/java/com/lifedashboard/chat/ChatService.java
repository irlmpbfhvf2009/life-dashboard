package com.lifedashboard.chat;

import com.lifedashboard.chat.dto.ConversationDto;
import com.lifedashboard.chat.dto.MessageDto;
import com.lifedashboard.common.exception.ForbiddenException;
import com.lifedashboard.common.exception.ResourceNotFoundException;
import com.lifedashboard.push.PushService;
import com.lifedashboard.security.CurrentUserService;
import com.lifedashboard.user.User;
import com.lifedashboard.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Chat backend: DMs, named groups, and the single PUBLIC room, all served over
 * plain REST (the frontend polls). Access to a conversation requires membership;
 * PUBLIC membership is created lazily on first access so everyone can join the
 * global room without an explicit step. Single Cloud Run instance (max=1), so
 * the public-room bootstrap can safely synchronize.
 */
@Service
@RequiredArgsConstructor
public class ChatService {

    private static final String PUBLIC_ROOM_NAME = "公開聊天室";
    private static final int MAX_CONTENT = 4000;

    private final CurrentUserService currentUserService;
    private final UserRepository userRepository;
    private final ConversationRepository conversationRepository;
    private final ConversationMemberRepository memberRepository;
    private final ChatMessageRepository messageRepository;
    private final PushService pushService;

    // ---- Conversation list -------------------------------------------------

    @Transactional
    public List<ConversationDto> listConversations() {
        Long me = currentUserService.getCurrentUserId();
        ensurePublicMembership(me);

        List<ConversationMember> memberships = memberRepository.findByUserId(me);
        Map<Long, User> userCache = new HashMap<>();
        List<ConversationDto> result = new ArrayList<>();
        for (ConversationMember m : memberships) {
            Conversation c = conversationRepository.findById(m.getConversationId()).orElse(null);
            if (c == null) continue;
            ChatMessage last = messageRepository.findFirstByConversationIdOrderByIdDesc(c.getId());
            boolean hasVisible = last != null && visible(last, m);
            // "Deleted" chats stay hidden until something new arrives.
            if (Boolean.TRUE.equals(m.getHidden()) && !hasVisible) continue;
            result.add(toDto(c, m, me, userCache));
        }
        result.sort(Comparator.comparing(ConversationDto::lastMessageAt).reversed());
        return result;
    }

    @Transactional(readOnly = true)
    public long totalUnread() {
        Long me = currentUserService.getCurrentUserId();
        long total = 0;
        for (ConversationMember m : memberRepository.findByUserId(me)) {
            total += messageRepository.countByConversationIdAndCreatedAtAfterAndSenderIdNot(
                    m.getConversationId(), effectiveRead(m), me);
        }
        return total;
    }

    // ---- Start conversations ----------------------------------------------

    @Transactional
    public ConversationDto createOrGetDm(Long otherUserId) {
        Long me = currentUserService.getCurrentUserId();
        if (otherUserId == null || otherUserId.equals(me)) {
            throw new IllegalArgumentException("無法和自己私訊");
        }
        userRepository.findById(otherUserId)
                .orElseThrow(() -> new ResourceNotFoundException("使用者不存在"));

        for (Long convId : memberRepository.findSharedConversationIds(me, otherUserId)) {
            Conversation c = conversationRepository.findById(convId).orElse(null);
            if (c != null && c.getType() == ConversationType.DM) {
                ConversationMember mine = memberRepository.findByConversationIdAndUserId(convId, me).orElseThrow();
                return toDto(c, mine, me, new HashMap<>());
            }
        }
        Conversation c = conversationRepository.save(Conversation.builder()
                .type(ConversationType.DM)
                .createdBy(me)
                .lastMessageAt(Instant.now())
                .build());
        addMember(c.getId(), me);
        addMember(c.getId(), otherUserId);
        ConversationMember mine = memberRepository.findByConversationIdAndUserId(c.getId(), me).orElseThrow();
        return toDto(c, mine, me, new HashMap<>());
    }

    @Transactional
    public ConversationDto createGroup(String name, List<Long> memberIds) {
        Long me = currentUserService.getCurrentUserId();
        String trimmed = name == null ? "" : name.trim();
        if (trimmed.isEmpty()) throw new IllegalArgumentException("請輸入群組名稱");
        if (trimmed.length() > 120) trimmed = trimmed.substring(0, 120);

        Set<Long> ids = new LinkedHashSet<>();
        if (memberIds != null) {
            for (Long id : memberIds) {
                if (id != null && !id.equals(me) && userRepository.existsById(id)) ids.add(id);
            }
        }
        Conversation c = conversationRepository.save(Conversation.builder()
                .type(ConversationType.GROUP)
                .name(trimmed)
                .createdBy(me)
                .lastMessageAt(Instant.now())
                .build());
        addMember(c.getId(), me);
        for (Long id : ids) addMember(c.getId(), id);
        ConversationMember mine = memberRepository.findByConversationIdAndUserId(c.getId(), me).orElseThrow();
        return toDto(c, mine, me, new HashMap<>());
    }

    /** Add friends to a group I belong to. */
    @Transactional
    public void addGroupMembers(Long conversationId, List<Long> memberIds) {
        Long me = currentUserService.getCurrentUserId();
        Conversation c = requireConversation(conversationId);
        requireMembership(c, me);
        if (c.getType() != ConversationType.GROUP) throw new IllegalArgumentException("只有群組能加成員");
        if (memberIds == null) return;
        for (Long id : memberIds) {
            if (id != null && userRepository.existsById(id)
                    && memberRepository.findByConversationIdAndUserId(conversationId, id).isEmpty()) {
                addMember(conversationId, id);
            }
        }
    }

    /** Leave a group (DMs / public cannot be left). */
    @Transactional
    public void leaveConversation(Long conversationId) {
        Long me = currentUserService.getCurrentUserId();
        Conversation c = requireConversation(conversationId);
        if (c.getType() != ConversationType.GROUP) throw new IllegalArgumentException("只能退出群組");
        memberRepository.findByConversationIdAndUserId(conversationId, me)
                .ifPresent(memberRepository::delete);
    }

    // ---- Messages ----------------------------------------------------------

    @Transactional
    public List<MessageDto> getMessages(Long conversationId, Long beforeId, Long afterId) {
        Long me = currentUserService.getCurrentUserId();
        Conversation c = requireConversation(conversationId);
        ConversationMember mine = requireMembership(c, me);

        List<ChatMessage> msgs;
        if (afterId != null) {
            msgs = messageRepository.findByConversationIdAndIdGreaterThanOrderByIdAsc(conversationId, afterId);
        } else if (beforeId != null) {
            msgs = new ArrayList<>(messageRepository
                    .findTop50ByConversationIdAndIdLessThanOrderByIdDesc(conversationId, beforeId));
            java.util.Collections.reverse(msgs);
        } else {
            msgs = new ArrayList<>(messageRepository.findTop50ByConversationIdOrderByIdDesc(conversationId));
            java.util.Collections.reverse(msgs);
        }
        // Hide anything cleared by me ("clear history" is per-user).
        Map<Long, User> cache = new HashMap<>();
        return msgs.stream()
                .filter(m -> visible(m, mine))
                .map(m -> toMessageDto(m, cache)).toList();
    }

    /** A message is visible to a member unless it predates their clear-history mark. */
    private boolean visible(ChatMessage m, ConversationMember member) {
        Instant cleared = member.getClearedAt();
        return cleared == null || m.getCreatedAt().isAfter(cleared);
    }

    @Transactional
    public MessageDto sendMessage(Long conversationId, String content, String kindStr,
                                  String attachmentUrl, Long replyToId, String forwardedFrom) {
        Long me = currentUserService.getCurrentUserId();
        Conversation c = requireConversation(conversationId);
        ConversationMember mine = requireMembership(c, me);

        MessageKind kind = parseKind(kindStr);
        String text = content == null ? "" : content.trim();
        String attachment = attachmentUrl == null ? null : attachmentUrl.trim();

        if (kind == MessageKind.TEXT) {
            if (text.isEmpty()) throw new IllegalArgumentException("訊息不能為空");
            attachment = null;
        } else {
            if (attachment == null || attachment.isEmpty()) throw new IllegalArgumentException("缺少附件");
            if (attachment.length() > MAX_CONTENT) throw new IllegalArgumentException("附件網址過長");
        }
        if (text.length() > MAX_CONTENT) text = text.substring(0, MAX_CONTENT);

        // Only honor a reply that points at a message in this same conversation.
        Long replyTo = null;
        if (replyToId != null) {
            ChatMessage target = messageRepository.findById(replyToId).orElse(null);
            if (target != null && target.getConversationId().equals(conversationId)) replyTo = replyToId;
        }
        String forwarded = forwardedFrom == null || forwardedFrom.isBlank()
                ? null : forwardedFrom.trim();
        if (forwarded != null && forwarded.length() > 120) forwarded = forwarded.substring(0, 120);

        ChatMessage saved = messageRepository.save(ChatMessage.builder()
                .conversationId(conversationId)
                .senderId(me)
                .kind(kind)
                .content(text)
                .attachmentUrl(attachment)
                .replyToId(replyTo)
                .forwardedFrom(forwarded)
                .build());
        c.setLastMessageAt(saved.getCreatedAt());
        conversationRepository.save(c);
        // Sending implicitly catches the sender up and un-hides a deleted chat.
        mine.setLastReadAt(saved.getCreatedAt());
        mine.setHidden(false);
        memberRepository.save(mine);

        notifyRecipients(c, saved, me);
        return toMessageDto(saved, new HashMap<>());
    }

    /** Fan a Web Push notification out to everyone in the conversation but the sender. */
    private void notifyRecipients(Conversation c, ChatMessage msg, Long senderId) {
        Map<Long, User> cache = new HashMap<>();
        User sender = user(senderId, cache);
        String senderName = displayName(sender);
        String title = c.getType() == ConversationType.DM
                ? senderName
                : (c.getName() != null && !c.getName().isBlank() ? c.getName() : "群組訊息");
        String body = c.getType() == ConversationType.DM
                ? preview(msg)
                : senderName + "：" + preview(msg);

        List<Long> recipients = memberRepository.findByConversationId(c.getId()).stream()
                .map(ConversationMember::getUserId)
                .filter(uid -> !uid.equals(senderId))
                .toList();

        pushService.sendToUsers(recipients, title, body, Map.of(
                "conversationId", String.valueOf(c.getId()),
                "type", c.getType().name()));
    }

    /**
     * Watermark up to which <em>at least one other</em> member has read — drives
     * the sender-side read receipt (the second tick), Telegram-style: a message
     * shows two ticks as soon as anyone has seen it. This is the <em>max</em> of
     * the other members' lastReadAt (for a DM that's simply the other person).
     * Returns null when nobody else has read anything yet (single "sent" tick).
     * Use {@link #messageReaders} for the exact "who has read this" list.
     */
    @Transactional(readOnly = true)
    public Instant readWatermark(Long conversationId) {
        Long me = currentUserService.getCurrentUserId();
        requireConversation(conversationId);
        memberRepository.findByConversationIdAndUserId(conversationId, me)
                .orElseThrow(() -> new ForbiddenException("你不在這個對話中"));

        Instant max = null;
        for (ConversationMember m : memberRepository.findByConversationId(conversationId)) {
            if (m.getUserId().equals(me)) continue;
            Instant r = m.getLastReadAt();
            if (r != null && (max == null || r.isAfter(max))) max = r;
        }
        return max;
    }

    /** Members (other than me) who have read a specific message of mine, newest
     *  read first — powers the "seen by" list. */
    @Transactional(readOnly = true)
    public List<ReaderDto> messageReaders(Long conversationId, Long messageId) {
        Long me = currentUserService.getCurrentUserId();
        requireConversation(conversationId);
        memberRepository.findByConversationIdAndUserId(conversationId, me)
                .orElseThrow(() -> new ForbiddenException("你不在這個對話中"));

        ChatMessage msg = messageRepository.findById(messageId)
                .orElseThrow(() -> new ResourceNotFoundException("訊息不存在"));
        if (!msg.getConversationId().equals(conversationId)) {
            throw new ForbiddenException("訊息不屬於這個對話");
        }
        Instant at = msg.getCreatedAt();
        Map<Long, User> cache = new HashMap<>();
        List<ReaderDto> readers = new ArrayList<>();
        for (ConversationMember m : memberRepository.findByConversationId(conversationId)) {
            if (m.getUserId().equals(me)) continue;
            Instant r = m.getLastReadAt();
            if (r != null && !r.isBefore(at)) {
                User u = user(m.getUserId(), cache);
                readers.add(new ReaderDto(m.getUserId(), displayName(u),
                        u == null ? null : u.getPhotoUrl(), r));
            }
        }
        readers.sort(Comparator.comparing(ReaderDto::readAt).reversed());
        return readers;
    }

    public record ReaderDto(Long userId, String name, String photoUrl, Instant readAt) {}

    @Transactional
    public void markRead(Long conversationId) {
        Long me = currentUserService.getCurrentUserId();
        Conversation c = requireConversation(conversationId);
        ConversationMember mine = requireMembership(c, me);
        mine.setLastReadAt(Instant.now());
        mine.setHidden(false);
        memberRepository.save(mine);
    }

    /** Unsend one of my own messages — removes it for everyone (Telegram-style). */
    @Transactional
    public void recallMessage(Long conversationId, Long messageId) {
        Long me = currentUserService.getCurrentUserId();
        Conversation c = requireConversation(conversationId);
        requireMembership(c, me);
        ChatMessage msg = messageRepository.findById(messageId)
                .orElseThrow(() -> new ResourceNotFoundException("訊息不存在"));
        if (!msg.getConversationId().equals(conversationId)) {
            throw new ForbiddenException("訊息不屬於這個對話");
        }
        if (!msg.getSenderId().equals(me)) {
            throw new ForbiddenException("只能收回自己的訊息");
        }
        // Pinned message being recalled → clear the pin.
        if (Long.valueOf(messageId).equals(c.getPinnedMessageId())) {
            c.setPinnedMessageId(null);
            conversationRepository.save(c);
        }
        messageRepository.delete(msg);
    }

    /** Edit one of my own text messages. */
    @Transactional
    public MessageDto editMessage(Long conversationId, Long messageId, String content) {
        Long me = currentUserService.getCurrentUserId();
        Conversation c = requireConversation(conversationId);
        requireMembership(c, me);
        ChatMessage msg = messageRepository.findById(messageId)
                .orElseThrow(() -> new ResourceNotFoundException("訊息不存在"));
        if (!msg.getConversationId().equals(conversationId)) {
            throw new ForbiddenException("訊息不屬於這個對話");
        }
        if (!msg.getSenderId().equals(me)) throw new ForbiddenException("只能編輯自己的訊息");
        MessageKind kind = msg.getKind() == null ? MessageKind.TEXT : msg.getKind();
        if (kind != MessageKind.TEXT) throw new IllegalArgumentException("只能編輯文字訊息");
        String text = content == null ? "" : content.trim();
        if (text.isEmpty()) throw new IllegalArgumentException("訊息不能為空");
        if (text.length() > MAX_CONTENT) text = text.substring(0, MAX_CONTENT);
        msg.setContent(text);
        msg.setEditedAt(Instant.now());
        messageRepository.save(msg);
        return toMessageDto(msg, new HashMap<>());
    }

    /** Pin a message in the conversation (single pinned message); null clears it. */
    @Transactional
    public void setPinned(Long conversationId, Long messageId) {
        Long me = currentUserService.getCurrentUserId();
        Conversation c = requireConversation(conversationId);
        requireMembership(c, me);
        if (messageId != null) {
            ChatMessage msg = messageRepository.findById(messageId)
                    .orElseThrow(() -> new ResourceNotFoundException("訊息不存在"));
            if (!msg.getConversationId().equals(conversationId)) {
                throw new ForbiddenException("訊息不屬於這個對話");
            }
        }
        c.setPinnedMessageId(messageId);
        conversationRepository.save(c);
    }

    /** Clear history for me only — marks everything up to now as hidden. */
    @Transactional
    public void clearHistory(Long conversationId) {
        Long me = currentUserService.getCurrentUserId();
        Conversation c = requireConversation(conversationId);
        ConversationMember mine = requireMembership(c, me);
        Instant now = Instant.now();
        mine.setClearedAt(now);
        mine.setLastReadAt(now);
        memberRepository.save(mine);
    }

    /** Remove a chat from my list: DM → hide (reappears on a new message);
     *  GROUP → leave; PUBLIC → not allowed. */
    @Transactional
    public void deleteChat(Long conversationId) {
        Long me = currentUserService.getCurrentUserId();
        Conversation c = requireConversation(conversationId);
        ConversationMember mine = requireMembership(c, me);
        if (c.getType() == ConversationType.PUBLIC) {
            throw new IllegalArgumentException("公開聊天室無法刪除");
        }
        if (c.getType() == ConversationType.GROUP) {
            memberRepository.delete(mine); // leaving the group
            return;
        }
        Instant now = Instant.now();
        mine.setClearedAt(now);
        mine.setLastReadAt(now);
        mine.setHidden(true);
        memberRepository.save(mine);
    }

    // ---- Helpers -----------------------------------------------------------

    private synchronized void ensurePublicMembership(Long userId) {
        Conversation room = conversationRepository.findFirstByType(ConversationType.PUBLIC)
                .orElseGet(() -> conversationRepository.save(Conversation.builder()
                        .type(ConversationType.PUBLIC)
                        .name(PUBLIC_ROOM_NAME)
                        .lastMessageAt(Instant.now())
                        .build()));
        if (memberRepository.findByConversationIdAndUserId(room.getId(), userId).isEmpty()) {
            addMember(room.getId(), userId);
        }
    }

    private ConversationMember requireMembership(Conversation c, Long userId) {
        return memberRepository.findByConversationIdAndUserId(c.getId(), userId)
                .orElseGet(() -> {
                    if (c.getType() == ConversationType.PUBLIC) return addMember(c.getId(), userId);
                    throw new ForbiddenException("你不在這個對話中");
                });
    }

    private Conversation requireConversation(Long id) {
        return conversationRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("對話不存在"));
    }

    private ConversationMember addMember(Long conversationId, Long userId) {
        return memberRepository.save(ConversationMember.builder()
                .conversationId(conversationId)
                .userId(userId)
                .build());
    }

    private Instant effectiveRead(ConversationMember m) {
        return m.getLastReadAt() != null ? m.getLastReadAt() : m.getJoinedAt();
    }

    private User user(Long id, Map<Long, User> cache) {
        return cache.computeIfAbsent(id, k -> userRepository.findById(k).orElse(null));
    }

    private MessageKind parseKind(String s) {
        if (s == null || s.isBlank()) return MessageKind.TEXT;
        try {
            return MessageKind.valueOf(s.trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            return MessageKind.TEXT;
        }
    }

    private String displayName(User u) {
        if (u == null) return "";
        return u.getDisplayName() != null && !u.getDisplayName().isBlank()
                ? u.getDisplayName() : u.getEmail();
    }

    /** Short text for conversation-list previews and push bodies. */
    private String preview(ChatMessage m) {
        MessageKind k = m.getKind() == null ? MessageKind.TEXT : m.getKind();
        return switch (k) {
            case IMAGE -> "[圖片]";
            case GIF -> "[GIF]";
            case AUDIO -> "[語音訊息]";
            case TEXT -> m.getContent();
        };
    }

    private ConversationDto toDto(Conversation c, ConversationMember mine, Long me, Map<Long, User> cache) {
        String name = c.getName();
        String photoUrl = null;
        Long otherUserId = null;

        if (c.getType() == ConversationType.DM) {
            for (ConversationMember m : memberRepository.findByConversationId(c.getId())) {
                if (!m.getUserId().equals(me)) {
                    User other = user(m.getUserId(), cache);
                    if (other != null) {
                        name = other.getDisplayName() != null && !other.getDisplayName().isBlank()
                                ? other.getDisplayName() : other.getEmail();
                        photoUrl = other.getPhotoUrl();
                        otherUserId = other.getId();
                    }
                    break;
                }
            }
        }

        ChatMessage last = messageRepository.findFirstByConversationIdOrderByIdDesc(c.getId());
        ConversationDto.LastMessage lastMessage = null;
        if (last != null && visible(last, mine)) {
            User sender = user(last.getSenderId(), cache);
            lastMessage = new ConversationDto.LastMessage(preview(last), displayName(sender), last.getCreatedAt());
        }

        long unread = messageRepository.countByConversationIdAndCreatedAtAfterAndSenderIdNot(
                c.getId(), effectiveRead(mine), me);
        int memberCount = (int) memberRepository.countByConversationId(c.getId());

        ConversationDto.PinnedMessage pinned = null;
        if (c.getPinnedMessageId() != null) {
            ChatMessage pm = messageRepository.findById(c.getPinnedMessageId()).orElse(null);
            if (pm != null && visible(pm, mine)) {
                pinned = new ConversationDto.PinnedMessage(
                        pm.getId(), preview(pm), displayName(user(pm.getSenderId(), cache)));
            }
        }

        return new ConversationDto(c.getId(), c.getType().name(), name, photoUrl, otherUserId,
                memberCount, lastMessage, unread, c.getLastMessageAt(), pinned);
    }

    private MessageDto toMessageDto(ChatMessage m, Map<Long, User> cache) {
        User sender = user(m.getSenderId(), cache);
        String photo = sender == null ? null : sender.getPhotoUrl();
        MessageKind kind = m.getKind() == null ? MessageKind.TEXT : m.getKind();

        String replyToSender = null, replyToPreview = null;
        if (m.getReplyToId() != null) {
            ChatMessage target = messageRepository.findById(m.getReplyToId()).orElse(null);
            if (target != null) {
                replyToSender = displayName(user(target.getSenderId(), cache));
                replyToPreview = preview(target);
            }
        }
        return new MessageDto(m.getId(), m.getConversationId(), m.getSenderId(), displayName(sender), photo,
                kind.name(), m.getContent(), m.getAttachmentUrl(), m.getCreatedAt(),
                m.getReplyToId(), replyToSender, replyToPreview, m.getEditedAt(), m.getForwardedFrom());
    }
}
