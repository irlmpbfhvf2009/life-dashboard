// 難度導演 — 每 3 秒把「壓力值 0~100」算出來，映射成 5 級，
// 輸出生成倍率 / 補血倍率 / 菁英許可，並在瀕滅時做緊急減壓。
import { DIRECTOR } from '../../../shared/balance'
import type { Game } from './game'

export interface DirectorState {
  pressure: number
  level: number
  timer: number
  recentDowns: number[]        // 最近倒地的時間戳
  spawnPauseUntil: number
  recentKills: number[]        // 最近擊殺時間戳（擊殺速度）
  lastPanicAt: number
}

export const newDirector = (): DirectorState => ({
  pressure: 40, level: 3, timer: 0, recentDowns: [], spawnPauseUntil: 0,
  recentKills: [], lastPanicAt: -99,
})

export function directorTick(g: Game, dt: number): void {
  const d = g.director
  d.timer -= dt
  if (d.timer > 0) return
  d.timer = DIRECTOR.interval

  const now = g.time
  d.recentDowns = d.recentDowns.filter(t => now - t < 30)
  d.recentKills = d.recentKills.filter(t => now - t < 10)

  const ps = [...g.players.values()].filter(p => p.connected && p.status !== 'dead')
  if (!ps.length) return
  const avgHp = ps.reduce((s, p) => s + p.hp / Math.max(1, p.stats.maxHp), 0) / ps.length
  const downed = ps.filter(p => p.status === 'downed').length

  // 壓力來源加權（0~100）
  let pressure = 0
  pressure += (1 - avgHp) * 42                                   // 平均血量
  pressure += (downed / ps.length) * 30                          // 倒地人數
  pressure += Math.min(d.recentDowns.length, 3) * 8              // 近 30 秒倒地次數
  const enemyLoad = g.enemies.length / Math.max(10, g.caps.enemies)
  pressure += enemyLoad * 16                                     // 場上怪量
  pressure += g.enemies.filter(e => e.elite).length * 3          // 菁英數
  const killRate = d.recentKills.length / 10                     // 擊殺/秒
  pressure -= Math.min(killRate * 6, 12)                         // 清怪快 → 減壓
  if (g.mission && !g.mission.done && g.time > g.duration * 0.6) pressure += 6
  if (g.boss) pressure += (1 - g.boss.hp / g.boss.maxHp) < 0.3 ? 8 : 4

  d.pressure = Math.max(0, Math.min(100, pressure))
  const L = DIRECTOR.levels
  d.level = d.pressure < L[0] ? 1 : d.pressure < L[1] ? 2 : d.pressure < L[2] ? 3 : d.pressure < L[3] ? 4 : 5

  // Level 5：瀕臨滅團 — 暫停生成、清低價值小怪（每 10 秒最多觸發一次）
  if (d.level === 5 && now - d.lastPanicAt > 10) {
    d.lastPanicAt = now
    d.spawnPauseUntil = now + DIRECTOR.panicSpawnPause
    let culled = 0
    for (const e of g.enemies) {
      if (culled >= DIRECTOR.panicCullCount) break
      if (e.data.tier === 1 && !e.elite) { e.hp = 0; culled++ }
    }
  }
}

export const spawnMult = (g: Game) => DIRECTOR.spawnMult[g.director.level] ?? 1
export const healDropMult = (g: Game) => DIRECTOR.healDropMult[g.director.level] ?? 1
export const eliteAllowed = (g: Game) => DIRECTOR.eliteAllowed[g.director.level] ?? true
export const rewardMult = (g: Game) => DIRECTOR.rewardMult[g.director.level] ?? 1
