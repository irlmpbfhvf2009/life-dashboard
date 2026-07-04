package com.lifedashboard.game;

import com.lifedashboard.common.ApiResponse;
import com.lifedashboard.game.dto.Seth2SpinRequest;
import com.lifedashboard.game.dto.Seth2SpinResult;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/game")
@RequiredArgsConstructor
public class GameController {

    private final Seth2SlotService seth2SlotService;

    /** "荷魯斯覺醒・神眼之力" tumble slot — the full cascade sequence is resolved server-side. */
    @PostMapping("/seth2/spin")
    public ApiResponse<Seth2SpinResult> seth2Spin(@Valid @RequestBody Seth2SpinRequest request) {
        return ApiResponse.ok(seth2SlotService.spin(request.bet(), request.buy()));
    }
}
