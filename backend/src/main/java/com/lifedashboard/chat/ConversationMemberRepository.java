package com.lifedashboard.chat;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface ConversationMemberRepository extends JpaRepository<ConversationMember, Long> {

    List<ConversationMember> findByUserId(Long userId);

    List<ConversationMember> findByConversationId(Long conversationId);

    Optional<ConversationMember> findByConversationIdAndUserId(Long conversationId, Long userId);

    long countByConversationId(Long conversationId);

    /** Conversation ids both users belong to (used to find an existing DM). */
    @Query("select m.conversationId from ConversationMember m where m.userId = :a " +
            "and m.conversationId in (select m2.conversationId from ConversationMember m2 where m2.userId = :b)")
    List<Long> findSharedConversationIds(@Param("a") Long a, @Param("b") Long b);
}
