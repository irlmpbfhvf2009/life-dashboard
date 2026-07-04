package com.lifedashboard.game;

import com.lifedashboard.common.ApiResponse;
import com.lifedashboard.game.dto.Seth2SpinRequest;
import com.lifedashboard.game.dto.Seth2SpinResult;
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
    private final Seth2SlotService seth2SlotService;

    @PostMapping("/slot/spin")
    public ApiResponse<SpinResult> spin(@Valid @RequestBody SpinRequest request) {
        return ApiResponse.ok(gameService.spin(request.bet()));
    }

    /** "法老寶藏" tumble slot — the full cascade sequence is resolved server-side. */
    @PostMapping("/seth/spin")
    public ApiResponse<SethSpinResult> sethSpin(@Valid @RequestBody SethSpinRequest request) {
        return ApiResponse.ok(sethSlotService.spin(request.bet(), request.ante(), request.buyBonus()));
    }

    /** "戰神賽特II・覺醒之力" tumble slot — resolved server-side like /seth/spin. */
    @PostMapping("/seth2/spin")
    public ApiResponse<Seth2SpinResult> seth2Spin(@Valid @RequestBody Seth2SpinRequest request) {
        return ApiResponse.ok(seth2SlotService.spin(request.bet(), request.buy()));
    }
}
