package com.lifedashboard.veggie;

import com.lifedashboard.security.CurrentUserService;
import com.lifedashboard.user.User;
import com.lifedashboard.veggie.VeggieDtos.*;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class VeggieService {

    private static final ZoneId TAIPEI = ZoneId.of("Asia/Taipei");
    private static final Set<String> MODES = Set.of("quick", "standard", "endless", "daily");
    private static final int TOP_N = 20;

    private final VeggieScoreRepository repository;
    private final CurrentUserService currentUserService;

    private String todayKey() {
        return LocalDate.now(TAIPEI).toString(); // YYYY-MM-DD
    }

    private String normMode(String mode) {
        return mode != null && MODES.contains(mode) ? mode : "standard";
    }

    /** Upsert the caller's personal best for this bucket; returns whether it was a new best + rank. */
    @Transactional
    public SubmitResult submit(SubmitRequest req) {
        User user = currentUserService.getCurrentUser();
        String mode = normMode(req.mode());
        int players = Math.max(1, Math.min(4, req.players()));
        // Clamp to sane bounds so a tampered client can't post absurd numbers.
        int wave = Math.max(0, Math.min(9999, req.wave()));
        int kills = Math.max(0, Math.min(1_000_000, req.kills()));
        int duration = Math.max(0, Math.min(86_400, req.durationSec()));
        String dailyKey = req.daily() ? todayKey() : "";

        VeggieScore existing = repository
                .findByUserIdAndModeAndPlayersAndDailyKey(user.getId(), mode, players, dailyKey)
                .orElse(null);

        boolean best = existing == null
                || wave > existing.getWave()
                || (wave == existing.getWave() && kills > existing.getKills());

        String name = user.getDisplayName() != null && !user.getDisplayName().isBlank()
                ? user.getDisplayName() : (user.getEmail() != null ? user.getEmail().split("@")[0] : "勇者");

        if (best) {
            VeggieScore row = existing != null ? existing
                    : VeggieScore.builder().userId(user.getId()).mode(mode).players(players).dailyKey(dailyKey).build();
            row.setName(name.length() > 32 ? name.substring(0, 32) : name);
            row.setPhotoUrl(user.getPhotoUrl());
            row.setWave(wave);
            row.setKills(kills);
            row.setDurationSec(duration);
            repository.save(row);
        }

        int rank = (int) repository.countBetter(mode, players, dailyKey,
                best ? wave : existing.getWave(), best ? kills : existing.getKills()) + 1;
        return new SubmitResult(best, rank);
    }

    @Transactional(readOnly = true)
    public LeaderboardView leaderboard(String modeRaw, int playersRaw, boolean daily) {
        String mode = normMode(modeRaw);
        int players = Math.max(1, Math.min(4, playersRaw));
        String dailyKey = daily ? todayKey() : "";

        List<VeggieScore> top = repository.topBoard(mode, players, dailyKey, PageRequest.of(0, TOP_N));

        Long myUserId = null;
        try {
            myUserId = currentUserService.getCurrentUserId();
        } catch (RuntimeException ignored) {
            // leaderboard is viewable without the "me" row
        }

        List<Entry> entries = new ArrayList<>();
        int rank = 0;
        for (VeggieScore s : top) {
            rank++;
            entries.add(new Entry(rank, s.getName(), s.getPhotoUrl(),
                    s.getWave(), s.getKills(), s.getPlayers(), s.getDurationSec(),
                    myUserId != null && s.getUserId().equals(myUserId)));
        }

        Entry me = null;
        int myRank = 0;
        if (myUserId != null) {
            VeggieScore mine = repository
                    .findByUserIdAndModeAndPlayersAndDailyKey(myUserId, mode, players, dailyKey)
                    .orElse(null);
            if (mine != null) {
                myRank = (int) repository.countBetter(mode, players, dailyKey, mine.getWave(), mine.getKills()) + 1;
                me = new Entry(myRank, mine.getName(), mine.getPhotoUrl(),
                        mine.getWave(), mine.getKills(), mine.getPlayers(), mine.getDurationSec(), true);
            }
        }

        return new LeaderboardView(entries, me, myRank, daily, dailyKey);
    }
}
