package com.lifedashboard.game;

import com.lifedashboard.common.ApiResponse;
import com.lifedashboard.game.dto.SethSpinRequest;
import com.lifedashboard.game.dto.SethSpinResult;
import com.lifedashboard.game.dto.SpinRequest;
import com.lifedashboard.game.dto.SpinResult;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/game")
@RequiredArgsConstructor
public class GameController {

    private final GameService gameService;
    private final SethSlotService sethSlotService;

    @PostMapping("/slot/spin")
    public ApiResponse<SpinResult> spin(@Valid @RequestBody SpinRequest request) {
        return ApiResponse.ok(gameService.spin(request.bet()));
    }

    /** "法老寶藏" tumble slot — the full cascade sequence is resolved server-side. */
    @PostMapping("/seth/spin")
    public ApiResponse<SethSpinResult> sethSpin(@Valid @RequestBody SethSpinRequest request) {
        return ApiResponse.ok(sethSlotService.spin(request.bet(), request.ante(), request.buyBonus()));
    }
}
