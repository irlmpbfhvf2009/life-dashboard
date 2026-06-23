package com.lifedashboard.security;

import com.lifedashboard.common.exception.UnauthorizedException;
import com.lifedashboard.user.User;
import com.lifedashboard.user.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;

/**
 * Single entry point for "who is calling right now". Every service that needs to
 * scope queries to the logged-in user goes through here. It reads the verified
 * {@link FirebaseUserPrincipal} from the SecurityContext and maps it to the
 * persisted {@link User} (provisioning on first login).
 */
@Service
@RequiredArgsConstructor
public class CurrentUserService {

    private final UserService userService;

    public FirebaseUserPrincipal getPrincipal() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !(auth.getPrincipal() instanceof FirebaseUserPrincipal principal)) {
            throw new UnauthorizedException("No authenticated user");
        }
        return principal;
    }

    /**
     * Returns the current database user, creating it on first login.
     */
    public User getCurrentUser() {
        return userService.provisionFromFirebase(getPrincipal());
    }

    public Long getCurrentUserId() {
        return getCurrentUser().getId();
    }
}
