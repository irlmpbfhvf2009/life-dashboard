package com.lifedashboard.wallet;

import com.lifedashboard.common.ApiResponse;
import com.lifedashboard.wallet.dto.CompletionRequest;
import com.lifedashboard.wallet.dto.GrantResultDto;
import com.lifedashboard.wallet.dto.WalletDto;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/wallet")
@RequiredArgsConstructor
public class WalletController {

    private final WalletService walletService;

    @GetMapping
    public ApiResponse<WalletDto> get() {
        return ApiResponse.ok(walletService.getWallet());
    }

    @PostMapping("/daily-bonus")
    public ApiResponse<GrantResultDto> dailyBonus() {
        return ApiResponse.ok(walletService.claimDailyBonus());
    }

    @PostMapping("/completion")
    public ApiResponse<GrantResultDto> completion(@Valid @RequestBody CompletionRequest request) {
        return ApiResponse.ok(walletService.settleCompletion(request));
    }
}
