package com.lifedashboard.social;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface FriendshipRepository extends JpaRepository<Friendship, Long> {

    /** The single relationship row between two users, in either direction. */
    @Query("select f from Friendship f where " +
            "(f.requesterId = :a and f.addresseeId = :b) or " +
            "(f.requesterId = :b and f.addresseeId = :a)")
    Optional<Friendship> findBetween(@Param("a") Long a, @Param("b") Long b);

    /** All rows in a given status that involve the user on either side. */
    @Query("select f from Friendship f where " +
            "(f.requesterId = :uid or f.addresseeId = :uid) and f.status = :status " +
            "order by f.updatedAt desc")
    List<Friendship> findAllByUserAndStatus(@Param("uid") Long uid,
                                            @Param("status") FriendshipStatus status);

    /** Pending invites this user has received. */
    List<Friendship> findByAddresseeIdAndStatusOrderByCreatedAtDesc(Long addresseeId, FriendshipStatus status);

    /** Pending invites this user has sent. */
    List<Friendship> findByRequesterIdAndStatusOrderByCreatedAtDesc(Long requesterId, FriendshipStatus status);
}
