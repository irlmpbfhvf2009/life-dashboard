package com.lifedashboard.veggie;

import java.util.List;

/** Wire DTOs for the 菜菜勇者團 leaderboard. */
public class VeggieDtos {

    public record SubmitRequest(
            String mode, int players, int wave, int kills, int durationSec, boolean daily) {}

    public record Entry(
            int rank, String name, String photoUrl,
            int wave, int kills, int players, int durationSec, boolean mine) {}

    public record LeaderboardView(
            List<Entry> entries, Entry me, int myRank, boolean daily, String dailyKey) {}

    public record SubmitResult(boolean best, int rank) {}
}
