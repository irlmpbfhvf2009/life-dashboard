package com.lifedashboard.wallet;

import com.lifedashboard.common.ApiResponse;
import com.lifedashboard.wallet.dto.WalletDto;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/wallet")
@RequiredArgsConstructor
public class WalletController {

    private final WalletService walletService;

    /** Read-only balance (shown in the game hub). Coins are granted by admins
     *  or earned in games — there is no self-serve earning endpoint. */
    @GetMapping
    public ApiResponse<WalletDto> get() {
        return ApiResponse.ok(walletService.getWallet());
    }
}
