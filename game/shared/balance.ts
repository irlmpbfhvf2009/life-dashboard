// 平衡設定 — 所有可調數值集中在這裡，禁止 hardcode 在系統程式裡。
import type { Mode } from './types'

// ------------------------------------------------- 場地 / tick

export const ARENA = { w: 1800, h: 1800 }
export const TICK_HZ = 20
export const SNAP_HZ = 10
export const MOVE_INPUT_HZ = 15

// ------------------------------------------------- 人數縮放

export interface PlayerScale { hp: number; count: number; boss: number; objective: number }
export const PLAYER_SCALING: Record<number, PlayerScale> = {
  1: { hp: 1.0, count: 1.0, boss: 1.0, objective: 1.0 },
  2: { hp: 1.4, count: 1.35, boss: 1.8, objective: 1.35 },
  3: { hp: 1.8, count: 1.65, boss: 2.5, objective: 1.7 },
  4: { hp: 2.2, count: 1.9, boss: 3.2, objective: 2.0 },
}
/** 機關型任務（符文/踩點）依人數要求的機關數 */
export const OBJECT_COUNT: Record<number, number> = { 1: 1, 2: 2, 3: 2, 4: 3 }

// ------------------------------------------------- 難度層級（架構支援 10 級，第一版 3 級）

export interface DifficultyMod { name: string; enemyHp: number; enemyDmg: number; goldMult: number }
export const DIFFICULTIES: DifficultyMod[] = [
  { name: '普通', enemyHp: 1.0, enemyDmg: 1.0, goldMult: 1.0 },
  { name: '困難', enemyHp: 1.3, enemyDmg: 1.25, goldMult: 1.15 },
  { name: '夢魘', enemyHp: 1.7, enemyDmg: 1.5, goldMult: 1.3 },
]

// ------------------------------------------------- 波次

export const MODE_WAVES: Record<Mode, number> = { quick: 10, standard: 20, endless: 20, daily: 10 }

/** 每波 30 秒倒數；倒數結束後要把場上怪清光才進下一關（Boss 波不限時） */
export function waveDuration(_wave: number): number {
  return 30
}

export function isBossWave(mode: Mode, wave: number): 'mini' | 'big' | null {
  if (wave <= 20) {
    if (mode === 'quick' || mode === 'daily') return wave === 10 ? 'big' : null
    if (wave === 10) return 'mini'
    if (wave === 20) return 'big'
    return null
  }
  // 無盡：每 10 波大 Boss，每 5 波小 Boss
  if (wave % 10 === 0) return 'big'
  if (wave % 5 === 0) return 'mini'
  return null
}

/** 生成預算：整波要生出的「怪物點數」總量（怪物 tier 消耗 1/2/4 點）
 *  30 秒短波 = 同樣預算擠進更短時間 → 密度自然更高 */
export function spawnBudget(wave: number, players: number): number {
  // 前期溫和、中後段陡升（避免第 1~2 波就被淹死，但 5 波後很硬）
  const base = 14 + wave * 8 + Math.max(0, wave - 5) * 6
  return Math.round(base * PLAYER_SCALING[players].count)
}

/** 怪物血量隨波數成長（另乘人數 hp、難度 enemyHp、無盡加成） */
export function enemyHpScale(wave: number): number {
  let s = 1 + (wave - 1) * 0.36
  if (wave > 10) s += (wave - 10) * 0.22
  if (wave > 20) s += (wave - 20) * 0.4   // 無盡加壓
  return s
}
export function enemyDmgScale(wave: number): number {
  return 1 + (wave - 1) * 0.11 + Math.max(0, wave - 20) * 0.08
}

/** 菁英機率（每次生成擲骰；導演可調） */
export function eliteChance(wave: number): number {
  if (wave < 2) return 0.02
  return Math.min(0.06 + (wave - 2) * 0.02, 0.3)
}

/** 無盡模式全局詞綴：每 10 波 +1 */
export function endlessAffixCount(wave: number): number {
  return wave <= 20 ? 0 : Math.floor((wave - 20) / 10) + 1
}

// ------------------------------------------------- 玩家 / 經驗 / 復活

export function xpForLevel(level: number): number {
  return Math.round(10 + level * 8 + level * level * 0.9)
}

export const REVIVES_PER_MODE: Record<Mode, number> = { quick: 1, standard: 2, endless: 2, daily: 1 }
export const TEAM_REVIVE = { healPct: 0.4, clearRadius: 320 }

export const DOWNED = {
  baseReviveTime: 3.0,          // 秒（單人救）
  reviveTimePerDown: 1.0,       // 每次倒地 +1s
  maxReviveTime: 7.0,
  crawlSpeed: 40,
  reviveRadius: 90,
  revivedHpPct: 0.35,
  bleedOutTime: 45,             // 無人救援自動死亡
  multiRescuerBonus: 0.7,       // 每多 1 人救援 → 時間 ×0.7
}

// ------------------------------------------------- 效能上限（依人數）

export function caps(players: number) {
  return {
    enemies: [0, 60, 72, 82, 92][players] ?? 92,
    elites: [0, 5, 6, 7, 8][players] ?? 8,
    drops: 90,
    enemyProjectiles: 36,
    // 客戶端視覺（render.ts 遵守）
    clientParticles: 220,
    clientDamageNumbers: 30,
  }
}

/** 掉落物超量時的合併規則 */
export const DROP_MERGE = { xpMergeRadius: 60, checkAt: 70 }

// ------------------------------------------------- 掉落率

export const DROPS = {
  coinValue: { min: 1, max: 3 },
  eliteCoinBonus: 8,
  bossCoin: 60,
  heartChance: 0.018,           // 基準；乘導演 healDropMult
  heartHeal: 20,
  bigHeartHeal: 50,
  bigHeartChance: 0.2,          // 掉愛心時升級成大愛心的機率
  teamHeartChance: 0.06,        // 掉愛心時升級成團隊愛心
  teamHeartHeal: 15,
  itemChance: 0.012,
  chestChanceElite: 0.35,
  chestChanceBoss: 1.0,
  xpValue: { 1: 3, 2: 8, 3: 20 } as Record<number, number>,
  pickupBaseRange: 70,
  magnetSpeed: 520,
}

// ------------------------------------------------- 商店

export const SHOP = {
  offers: 4,
  refreshBase: 4,
  refreshGrowth: 2,             // 每次刷新 +2
  priceWaveGrowth: 0.08,        // 價格隨波數上浮
  sellPct: 0.8,
  maxWeapons: 6,
  teamReviveBasePrice: 28,
  teamRevivePriceGrowth: 16,
}

// ------------------------------------------------- 難度導演

export const DIRECTOR = {
  interval: 3,                  // 每 3 秒評估
  // 壓力值 0~100 → 5 級門檻
  levels: [18, 38, 62, 82],     // <18=1太簡單 <38=2 <62=3理想 <82=4偏難 else 5瀕滅
  spawnMult: { 1: 1.4, 2: 1.2, 3: 1.05, 4: 0.8, 5: 0.4 } as Record<number, number>,
  healDropMult: { 1: 0.35, 2: 0.6, 3: 1.0, 4: 1.8, 5: 3.0 } as Record<number, number>,
  eliteAllowed: { 1: true, 2: true, 3: true, 4: false, 5: false } as Record<number, boolean>,
  rewardMult: { 1: 1.15, 2: 1.05, 3: 1.0, 4: 1.0, 5: 1.0 } as Record<number, number>,
  /** Level 5：暫停普通怪生成秒數、清除低價值小怪數 */
  panicSpawnPause: 4,
  panicCullCount: 6,
}

// ------------------------------------------------- 事件平衡規則

export const EVENT_RULES = {
  chancePerWave: 0.55,          // 每波抽事件機率
  minWave: 3,
  maxConsecutiveDanger: 1,      // 連續 2 波不得都高危
  noDangerBeforeBoss: true,
  loseStreakSafeWaves: 3,       // 連敗後前 3 波降高危權重
  loseStreakDangerMult: 0.25,
}

// ------------------------------------------------- 隨機陷阱（場景危害）

export const TRAPS = {
  /** 每波陷阱數：base + wave 成長，封頂 */
  count: (wave: number) => Math.min(2 + Math.floor(wave / 3), 7),
  radius: 42,
  damage: 7,
  tickInterval: 0.8,            // 站在上面每 0.8 秒扣一次
  minDistFromCenter: 260,       // 避開出生點
  fromWave: 2,
}

// ------------------------------------------------- 任務

export const MISSION = {
  chancePerWave: 0.6,
  minWave: 4,
  killTargetScale: { 1: 1.0, 2: 1.4, 3: 1.8, 4: 2.2 } as Record<number, number>,
}
