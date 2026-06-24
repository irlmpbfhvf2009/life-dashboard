package com.lifedashboard.admin;

import com.lifedashboard.admin.dto.AdminUserDto;
import com.lifedashboard.admin.dto.RolesRequest;
import com.lifedashboard.common.exception.ForbiddenException;
import com.lifedashboard.common.exception.ResourceNotFoundException;
import com.lifedashboard.security.CurrentUserService;
import com.lifedashboard.user.User;
import com.lifedashboard.user.UserRepository;
import com.lifedashboard.user.UserService;
import com.lifedashboard.wallet.WalletService;
import com.lifedashboard.weight.WeightRepository;
import com.lifedashboard.weight.dto.WeightDto;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class AdminService {

    private final CurrentUserService currentUserService;
    private final UserRepository userRepository;
    private final WalletService walletService;
    private final WeightRepository weightRepository;

    private void requireAdmin() {
        if (!UserService.isAdmin(currentUserService.getCurrentUser())) {
            throw new ForbiddenException("Admin access required");
        }
    }

    private AdminUserDto toDto(User u) {
        return new AdminUserDto(
                u.getId(), u.getEmail(), u.getDisplayName(), u.getPhotoUrl(),
                walletService.balanceOf(u.getId()),
                Boolean.TRUE.equals(u.getIsPlayer()),
                UserService.isAdmin(u),
                u.getCreatedAt());
    }

    @Transactional(readOnly = true)
    public List<AdminUserDto> listUsers() {
        requireAdmin();
        return userRepository.findAll().stream()
                .sorted((a, b) -> a.getId().compareTo(b.getId()))
                .map(this::toDto)
                .toList();
    }

    @Transactional
    public AdminUserDto setRoles(Long userId, RolesRequest req) {
        requireAdmin();
        User u = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found: " + userId));
        u.setIsPlayer(Boolean.TRUE.equals(req.isPlayer()));
        // The root admin can never be demoted from admin.
        boolean rootAdmin = UserService.ROOT_ADMIN_EMAIL.equalsIgnoreCase(u.getEmail());
        u.setIsAdmin(rootAdmin || Boolean.TRUE.equals(req.isAdmin()));
        return toDto(userRepository.save(u));
    }

    @Transactional
    public AdminUserDto adjustCoins(Long userId, long delta) {
        requireAdmin();
        User u = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found: " + userId));
        walletService.applyDelta(userId, delta);
        return toDto(u);
    }

    @Transactional(readOnly = true)
    public List<WeightDto> weights(Long userId) {
        requireAdmin();
        if (!userRepository.existsById(userId)) {
            throw new ResourceNotFoundException("User not found: " + userId);
        }
        return weightRepository.findByUserIdOrderByDateDesc(userId).stream()
                .map(WeightDto::from).toList();
    }
}
