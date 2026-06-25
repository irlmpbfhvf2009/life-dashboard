package com.lifedashboard.push;

import com.lifedashboard.common.ApiResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/push")
@RequiredArgsConstructor
public class PushController {

    private final PushService pushService;

    public record TokenRequest(String token) {}

    /** Register this browser's Web Push token (called after the user grants permission). */
    @PostMapping("/token")
    public ApiResponse<Void> register(@RequestBody TokenRequest body) {
        pushService.register(body.token());
        return ApiResponse.ok();
    }

    /** Forget a token (e.g. on sign-out). */
    @DeleteMapping("/token")
    public ApiResponse<Void> unregister(@RequestBody TokenRequest body) {
        pushService.unregister(body.token());
        return ApiResponse.ok();
    }
}
