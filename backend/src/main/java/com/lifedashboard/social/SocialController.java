package com.lifedashboard.social;

import com.lifedashboard.common.ApiResponse;
import com.lifedashboard.social.dto.FriendProfileDto;
import com.lifedashboard.social.dto.FriendRequestDto;
import com.lifedashboard.social.dto.PrivacyDto;
import com.lifedashboard.social.dto.SocialUserDto;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/social")
@RequiredArgsConstructor
public class SocialController {

    private final SocialService socialService;

    /** Search users by name/email (min 2 chars), tagged with my relationship. */
    @GetMapping("/search")
    public ApiResponse<List<SocialUserDto>> search(@RequestParam(required = false) String q) {
        return ApiResponse.ok(socialService.search(q));
    }

    @GetMapping("/friends")
    public ApiResponse<List<SocialUserDto>> friends() {
        return ApiResponse.ok(socialService.listFriends());
    }

    @GetMapping("/requests/incoming")
    public ApiResponse<List<FriendRequestDto>> incoming() {
        return ApiResponse.ok(socialService.incomingRequests());
    }

    @GetMapping("/requests/outgoing")
    public ApiResponse<List<FriendRequestDto>> outgoing() {
        return ApiResponse.ok(socialService.outgoingRequests());
    }

    public record SendRequest(Long targetUserId) {}

    @PostMapping("/requests")
    public ApiResponse<Void> send(@RequestBody SendRequest body) {
        socialService.sendRequest(body.targetUserId());
        return ApiResponse.ok();
    }

    @PostMapping("/requests/{id}/accept")
    public ApiResponse<Void> accept(@PathVariable Long id) {
        socialService.acceptRequest(id);
        return ApiResponse.ok();
    }

    @PostMapping("/requests/{id}/decline")
    public ApiResponse<Void> decline(@PathVariable Long id) {
        socialService.declineRequest(id);
        return ApiResponse.ok();
    }

    @DeleteMapping("/friends/{userId}")
    public ApiResponse<Void> unfriend(@PathVariable Long userId) {
        socialService.removeFriend(userId);
        return ApiResponse.ok();
    }

    @GetMapping("/privacy")
    public ApiResponse<PrivacyDto> getPrivacy() {
        return ApiResponse.ok(socialService.getPrivacy());
    }

    @PutMapping("/privacy")
    public ApiResponse<PrivacyDto> updatePrivacy(@RequestBody PrivacyDto body) {
        return ApiResponse.ok(socialService.updatePrivacy(body));
    }

    /** A friend's profile — basic identity always, data sections only if shared. */
    @GetMapping("/profile/{userId}")
    public ApiResponse<FriendProfileDto> profile(@PathVariable Long userId) {
        return ApiResponse.ok(socialService.getFriendProfile(userId));
    }
}
