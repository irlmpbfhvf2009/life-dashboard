package com.lifedashboard.user;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface UserRepository extends JpaRepository<User, Long> {
    Optional<User> findByFirebaseUid(String firebaseUid);

    /** Find users by email or display name (case-insensitive), excluding self. */
    @Query("select u from User u where u.id <> :selfId and (" +
            "lower(u.email) like lower(concat('%', :q, '%')) or " +
            "lower(u.displayName) like lower(concat('%', :q, '%')))")
    List<User> search(@Param("q") String q, @Param("selfId") Long selfId, Pageable pageable);
}
