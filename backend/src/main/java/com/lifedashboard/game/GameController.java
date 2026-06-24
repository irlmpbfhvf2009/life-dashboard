package com.lifedashboard.game;

import com.lifedashboard.common.ApiResponse;
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

    @PostMapping("/slot/spin")
    public ApiResponse<SpinResult> spin(@Valid @RequestBody SpinRequest request) {
        return ApiResponse.ok(gameService.spin(request.bet()));
    }
}
