package com.lifedashboard.user;

import com.lifedashboard.common.ApiResponse;
import com.lifedashboard.security.CurrentUserService;
import com.lifedashboard.user.dto.UpdateUserRequest;
import com.lifedashboard.user.dto.UserDto;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/me")
@RequiredArgsConstructor
public class UserController {

    private final CurrentUserService currentUserService;
    private final UserService userService;

    @GetMapping
    public ApiResponse<UserDto> me() {
        return ApiResponse.ok(UserDto.from(currentUserService.getCurrentUser()));
    }

    @PatchMapping
    public ApiResponse<UserDto> update(@Valid @RequestBody UpdateUserRequest request) {
        User updated = userService.updateProfile(currentUserService.getCurrentUser(), request);
        return ApiResponse.ok(UserDto.from(updated));
    }

    /** Record which portal the user signed up on, granting that portal's default
     *  role to brand-new users (game → player, studio → studio). */
    @PostMapping("/source/{source}")
    public ApiResponse<UserDto> source(@PathVariable String source) {
        User u = userService.applyDefaultRole(currentUserService.getCurrentUser(), source);
        return ApiResponse.ok(UserDto.from(u));
    }
}
