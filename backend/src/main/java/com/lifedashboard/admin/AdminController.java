package com.lifedashboard.admin;

import com.lifedashboard.admin.dto.AdminUserDto;
import com.lifedashboard.admin.dto.CoinDeltaRequest;
import com.lifedashboard.admin.dto.RolesRequest;
import com.lifedashboard.common.ApiResponse;
import com.lifedashboard.weight.dto.WeightDto;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/admin")
@RequiredArgsConstructor
public class AdminController {

    private final AdminService adminService;

    @GetMapping("/users")
    public ApiResponse<List<AdminUserDto>> users() {
        return ApiResponse.ok(adminService.listUsers());
    }

    @PatchMapping("/users/{id}/roles")
    public ApiResponse<AdminUserDto> setRoles(@PathVariable Long id, @RequestBody RolesRequest request) {
        return ApiResponse.ok(adminService.setRoles(id, request));
    }

    @PostMapping("/users/{id}/coins")
    public ApiResponse<AdminUserDto> adjustCoins(@PathVariable Long id, @RequestBody CoinDeltaRequest request) {
        return ApiResponse.ok(adminService.adjustCoins(id, request.delta()));
    }

    @GetMapping("/users/{id}/weights")
    public ApiResponse<List<WeightDto>> weights(@PathVariable Long id) {
        return ApiResponse.ok(adminService.weights(id));
    }
}
