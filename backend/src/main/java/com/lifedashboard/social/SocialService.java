package com.lifedashboard.social;

import com.lifedashboard.common.exception.ForbiddenException;
import com.lifedashboard.common.exception.ResourceNotFoundException;
import com.lifedashboard.food.FoodRepository;
import com.lifedashboard.food.dto.FoodDto;
import com.lifedashboard.mood.MoodRepository;
import com.lifedashboard.mood.dto.MoodDto;
import com.lifedashboard.security.CurrentUserService;
import com.lifedashboard.social.dto.FriendProfileDto;
import com.lifedashboard.social.dto.FriendRequestDto;
import com.lifedashboard.social.dto.PrivacyDto;
import com.lifedashboard.social.dto.SocialUserDto;
import com.lifedashboard.todo.TodoRepository;
import com.lifedashboard.todo.TodoStatus;
import com.lifedashboard.user.User;
import com.lifedashboard.user.UserRepository;
import com.lifedashboard.weight.WeightRepository;
import com.lifedashboard.weight.dto.WeightDto;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

/**
 * Friend graph + privacy-gated profile viewing. Relationships are mutual
 * (request → accept). A friend can only see the data modules the owner has
 * opted to share via {@link SocialPrivacy}; basic identity is always visible to
 * friends. All data queries are scoped to the target user's id.
 */
@Service
@RequiredArgsConstructor
public class SocialService {

    static final String NONE = "NONE";
    static final String REQUEST_SENT = "REQUEST_SENT";
    static final String REQUEST_RECEIVED = "REQUEST_RECEIVED";
    static final String FRIEND = "FRIEND";

    private final CurrentUserService currentUserService;
    private final UserRepository userRepository;
    private final FriendshipRepository friendshipRepository;
    private final SocialPrivacyRepository privacyRepository;
    private final WeightRepository weightRepository;
    private final FoodRepository foodRepository;
    private final MoodRepository moodRepository;
    private final TodoRepository todoRepository;

    // ---- Search & lists ----------------------------------------------------

    @Transactional(readOnly = true)
    public List<SocialUserDto> search(String query) {
        String q = query == null ? "" : query.trim();
        if (q.length() < 2) return List.of();
        Long me = currentUserService.getCurrentUserId();
        return userRepository.search(q, me, PageRequest.of(0, 20)).stream()
                .map(u -> toSocialUser(u, me))
                .toList();
    }

    @Transactional(readOnly = true)
    public List<SocialUserDto> listFriends() {
        Long me = currentUserService.getCurrentUserId();
        return friendshipRepository.findAllByUserAndStatus(me, FriendshipStatus.ACCEPTED).stream()
                .map(f -> {
                    Long otherId = otherSide(f, me);
                    return userRepository.findById(otherId)
                            .map(u -> SocialUserDto.of(u, FRIEND, f.getUpdatedAt()))
                            .orElse(null);
                })
                .filter(java.util.Objects::nonNull)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<FriendRequestDto> incomingRequests() {
        Long me = currentUserService.getCurrentUserId();
        return friendshipRepository.findByAddresseeIdAndStatusOrderByCreatedAtDesc(me, FriendshipStatus.PENDING)
                .stream()
                .map(f -> userRepository.findById(f.getRequesterId())
                        .map(u -> new FriendRequestDto(f.getId(),
                                SocialUserDto.of(u, REQUEST_RECEIVED, f.getCreatedAt()), f.getCreatedAt()))
                        .orElse(null))
                .filter(java.util.Objects::nonNull)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<FriendRequestDto> outgoingRequests() {
        Long me = currentUserService.getCurrentUserId();
        return friendshipRepository.findByRequesterIdAndStatusOrderByCreatedAtDesc(me, FriendshipStatus.PENDING)
                .stream()
                .map(f -> userRepository.findById(f.getAddresseeId())
                        .map(u -> new FriendRequestDto(f.getId(),
                                SocialUserDto.of(u, REQUEST_SENT, f.getCreatedAt()), f.getCreatedAt()))
                        .orElse(null))
                .filter(java.util.Objects::nonNull)
                .toList();
    }

    // ---- Mutations ---------------------------------------------------------

    /** Send (or auto-accept a reciprocal) friend request to the target user. */
    @Transactional
    public void sendRequest(Long targetUserId) {
        Long me = currentUserService.getCurrentUserId();
        if (targetUserId == null || targetUserId.equals(me)) {
            throw new IllegalArgumentException("不能加自己為好友");
        }
        userRepository.findById(targetUserId)
                .orElseThrow(() -> new ResourceNotFoundException("使用者不存在"));

        Optional<Friendship> existing = friendshipRepository.findBetween(me, targetUserId);
        if (existing.isPresent()) {
            Friendship f = existing.get();
            if (f.getStatus() == FriendshipStatus.ACCEPTED) {
                throw new IllegalArgumentException("你們已經是好友");
            }
            // Pending. If the other side already invited me, accept it instead of
            // creating a duplicate row; otherwise it's a re-send (no-op).
            if (f.getAddresseeId().equals(me)) {
                f.setStatus(FriendshipStatus.ACCEPTED);
                friendshipRepository.save(f);
            }
            return;
        }
        friendshipRepository.save(Friendship.builder()
                .requesterId(me)
                .addresseeId(targetUserId)
                .status(FriendshipStatus.PENDING)
                .build());
    }

    /** Accept a pending invite addressed to me. */
    @Transactional
    public void acceptRequest(Long requestId) {
        Long me = currentUserService.getCurrentUserId();
        Friendship f = friendshipRepository.findById(requestId)
                .orElseThrow(() -> new ResourceNotFoundException("邀請不存在"));
        if (!f.getAddresseeId().equals(me) || f.getStatus() != FriendshipStatus.PENDING) {
            throw new ForbiddenException("無法接受這個邀請");
        }
        f.setStatus(FriendshipStatus.ACCEPTED);
        friendshipRepository.save(f);
    }

    /** Decline an incoming invite, or cancel one I sent. Either deletes the row. */
    @Transactional
    public void declineRequest(Long requestId) {
        Long me = currentUserService.getCurrentUserId();
        Friendship f = friendshipRepository.findById(requestId)
                .orElseThrow(() -> new ResourceNotFoundException("邀請不存在"));
        if (f.getStatus() != FriendshipStatus.PENDING
                || (!f.getAddresseeId().equals(me) && !f.getRequesterId().equals(me))) {
            throw new ForbiddenException("無法處理這個邀請");
        }
        friendshipRepository.delete(f);
    }

    /** Unfriend: delete the accepted relationship with the given user. */
    @Transactional
    public void removeFriend(Long otherUserId) {
        Long me = currentUserService.getCurrentUserId();
        Friendship f = friendshipRepository.findBetween(me, otherUserId)
                .filter(x -> x.getStatus() == FriendshipStatus.ACCEPTED)
                .orElseThrow(() -> new ResourceNotFoundException("你們不是好友"));
        friendshipRepository.delete(f);
    }

    // ---- Privacy -----------------------------------------------------------

    @Transactional(readOnly = true)
    public PrivacyDto getPrivacy() {
        Long me = currentUserService.getCurrentUserId();
        return PrivacyDto.from(privacyRepository.findByUserId(me).orElse(null));
    }

    @Transactional
    public PrivacyDto updatePrivacy(PrivacyDto body) {
        Long me = currentUserService.getCurrentUserId();
        SocialPrivacy p = privacyRepository.findByUserId(me)
                .orElseGet(() -> SocialPrivacy.builder().userId(me).build());
        p.setShareHealth(body.shareHealth());
        p.setShareMood(body.shareMood());
        p.setShareLife(body.shareLife());
        return PrivacyDto.from(privacyRepository.save(p));
    }

    // ---- Friend profile (privacy-gated) ------------------------------------

    @Transactional(readOnly = true)
    public FriendProfileDto getFriendProfile(Long targetUserId) {
        Long me = currentUserService.getCurrentUserId();
        if (targetUserId.equals(me)) {
            throw new IllegalArgumentException("這是你自己");
        }
        // Must be friends to view anything.
        friendshipRepository.findBetween(me, targetUserId)
                .filter(f -> f.getStatus() == FriendshipStatus.ACCEPTED)
                .orElseThrow(() -> new ForbiddenException("你們不是好友，無法查看"));

        User target = userRepository.findById(targetUserId)
                .orElseThrow(() -> new ResourceNotFoundException("使用者不存在"));
        PrivacyDto privacy = PrivacyDto.from(privacyRepository.findByUserId(targetUserId).orElse(null));

        FriendProfileDto.Health health = privacy.shareHealth() ? buildHealth(targetUserId) : null;
        FriendProfileDto.Mood mood = privacy.shareMood() ? buildMood(targetUserId) : null;
        FriendProfileDto.Life life = privacy.shareLife() ? buildLife(targetUserId) : null;

        return new FriendProfileDto(
                target.getId(),
                target.getDisplayName(),
                target.getPhotoUrl(),
                target.getEmail(),
                target.getCreatedAt(),
                new FriendProfileDto.Visibility(privacy.shareHealth(), privacy.shareMood(), privacy.shareLife()),
                health, mood, life
        );
    }

    private FriendProfileDto.Health buildHealth(Long userId) {
        LocalDate today = LocalDate.now();
        List<WeightDto> trend = weightRepository
                .findByUserIdAndDateGreaterThanEqualOrderByDateAsc(userId, today.minusDays(29))
                .stream().map(WeightDto::from).toList();
        WeightDto latest = weightRepository.findFirstByUserIdOrderByDateDescIdDesc(userId)
                .map(WeightDto::from).orElse(null);
        List<FoodDto> foods = foodRepository.findTop5ByUserIdOrderByDateDescCreatedAtDesc(userId)
                .stream().map(FoodDto::from).toList();
        return new FriendProfileDto.Health(trend, latest, foods);
    }

    private FriendProfileDto.Mood buildMood(Long userId) {
        LocalDate today = LocalDate.now();
        List<MoodDto> recent = moodRepository
                .findByUserIdAndDateGreaterThanEqualOrderByDateAsc(userId, today.minusDays(29))
                .stream().map(MoodDto::from).toList();
        Double avg = recent.isEmpty() ? null : recent.stream()
                .filter(m -> m.moodScore() != null)
                .mapToInt(MoodDto::moodScore)
                .average().orElse(0);
        return new FriendProfileDto.Mood(recent, avg);
    }

    private FriendProfileDto.Life buildLife(Long userId) {
        LocalDate today = LocalDate.now();
        long open = todoRepository.countByUserIdAndStatus(userId, TodoStatus.TODO);
        long todayTodo = todoRepository.countByUserIdAndStatusAndDueDate(userId, TodoStatus.TODO, today);
        long todayDone = todoRepository.countByUserIdAndStatusAndDueDate(userId, TodoStatus.DONE, today);
        return new FriendProfileDto.Life(open, todayTodo, todayDone);
    }

    // ---- Helpers -----------------------------------------------------------

    private SocialUserDto toSocialUser(User u, Long me) {
        Optional<Friendship> rel = friendshipRepository.findBetween(me, u.getId());
        if (rel.isEmpty()) return SocialUserDto.of(u, NONE, null);
        Friendship f = rel.get();
        if (f.getStatus() == FriendshipStatus.ACCEPTED) return SocialUserDto.of(u, FRIEND, f.getUpdatedAt());
        String relation = f.getRequesterId().equals(me) ? REQUEST_SENT : REQUEST_RECEIVED;
        return SocialUserDto.of(u, relation, f.getCreatedAt());
    }

    private Long otherSide(Friendship f, Long me) {
        return f.getRequesterId().equals(me) ? f.getAddresseeId() : f.getRequesterId();
    }
}
