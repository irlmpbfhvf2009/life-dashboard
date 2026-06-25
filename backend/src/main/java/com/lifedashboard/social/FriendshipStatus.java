package com.lifedashboard.social;

/** State of a friendship row. We only persist these two; declines delete the row. */
public enum FriendshipStatus {
    PENDING,
    ACCEPTED
}
