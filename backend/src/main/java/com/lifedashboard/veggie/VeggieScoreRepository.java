package com.lifedashboard.veggie;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;

public interface VeggieScoreRepository extends JpaRepository<VeggieScore, Long> {

    Optional<VeggieScore> findByUserIdAndModeAndPlayersAndDailyKey(
            Long userId, String mode, int players, String dailyKey);

    /** Top of a board — wave desc, kills as tie-break. Use Pageable to cap. */
    @Query("select s from VeggieScore s where s.mode = ?1 and s.players = ?2 and s.dailyKey = ?3 "
            + "order by s.wave desc, s.kills desc, s.durationSec asc")
    List<VeggieScore> topBoard(String mode, int players, String dailyKey, Pageable pageable);

    /** How many runs beat a given (wave, kills) — for computing "my rank" with the same tie-break. */
    @Query("select count(s) from VeggieScore s where s.mode = ?1 and s.players = ?2 and s.dailyKey = ?3 "
            + "and (s.wave > ?4 or (s.wave = ?4 and s.kills > ?5))")
    long countBetter(String mode, int players, String dailyKey, int wave, int kills);
}
