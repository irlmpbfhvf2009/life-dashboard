package com.lifedashboard.veggie;

import com.lifedashboard.common.ApiResponse;
import com.lifedashboard.veggie.VeggieDtos.*;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

/**
 * 菜菜勇者團 leaderboard. Scores are submitted by the (authenticated) client when
 * a run ends; the game is casual co-op PvE with virtual currency, so we accept
 * client-reported results (clamped to sane bounds server-side). Guests (invite
 * links) simply don't rank.
 */
@RestController
@RequestMapping("/api/veggie")
@RequiredArgsConstructor
public class VeggieController {

    private final VeggieService service;

    /** Submit a finished run; keeps only the personal best per (mode, players, day). */
    @PostMapping("/score")
    public ApiResponse<SubmitResult> submit(@RequestBody SubmitRequest req) {
        return ApiResponse.ok(service.submit(req));
    }

    /** Top runs for a board + the caller's own best/rank. */
    @GetMapping("/leaderboard")
    public ApiResponse<LeaderboardView> leaderboard(
            @RequestParam(defaultValue = "standard") String mode,
            @RequestParam(defaultValue = "1") int players,
            @RequestParam(defaultValue = "false") boolean daily) {
        return ApiResponse.ok(service.leaderboard(mode, players, daily));
    }
}
