// 平衡設定 — 所有可調數值集中在這裡，禁止 hardcode 在系統程式裡。
import type { Mode } from './types'

// ------------------------------------------------- 場地 / tick

// 場地：1800×1800 太空曠 → 先砍成 1260×900，再回加（左右 +20%、上下 +10%）。
export const ARENA = { w: 1512, h: 990 }
/** 武器等級沒有上限：超過「階級上限（maxLevel）」之後，每一級讓武器傷害 ×1.06（乘算）。
 *  商店價格在超階後改走指數（shop.levelPriceMult），兩邊都是指數才有真正的無上限成長曲線。 */
export const WEAPON_OVER_DMG = 1.08

export const TICK_HZ = 20
export const SNAP_HZ = 10
export const MOVE_INPUT_HZ = 15
/** 全域怪物移動速度倍率（配合玩家提速，讓整體節奏更快） */
export const ENEMY_SPEED_MULT = 1.2

// ------------------------------------------------- 人數縮放

export interface PlayerScale { hp: number; count: number; boss: number; objective: number }
// 人數縮放：**怪物數量不隨人數增加**（count 恆 1.0），改成「每隻血更多」（hp）維持總難度。
// 目的＝多人時場上實體數維持單人水準，減輕免費伺服器 CPU 與客戶端渲染負擔（＝更順）。
// hp 值＝舊制的「count×hp 總血池」（2p:1.35×1.4≈1.9、3p:1.65×1.8≈3.0、4p:1.9×2.2≈4.2），總難度不變。
export const PLAYER_SCALING: Record<number, PlayerScale> = {
  1: { hp: 1.0, count: 1.0, boss: 1.0, objective: 1.0 },
  2: { hp: 1.9, count: 1.0, boss: 1.8, objective: 1.35 },
  3: { hp: 3.0, count: 1.0, boss: 2.5, objective: 1.7 },
  4: { hp: 4.2, count: 1.0, boss: 3.2, objective: 2.0 },
}
/** 機關型任務（符文/踩點）依人數要求的機關數 */
export const OBJECT_COUNT: Record<number, number> = { 1: 1, 2: 2, 3: 2, 4: 3 }

// ------------------------------------------------- 難度層級（架構支援 10 級，第一版 3 級）

export interface DifficultyMod { name: string; enemyHp: number; enemyDmg: number; goldMult: number }
export const DIFFICULTIES: DifficultyMod[] = [
  { name: '普通', enemyHp: 1.0, enemyDmg: 1.0, goldMult: 1.0 },
  { name: '困難', enemyHp: 1.3, enemyDmg: 1.25, goldMult: 1.15 },
  // 夢魘（固定難度）：主要難度改由 enemyHpScale 指數曲線扛，這裡別再疊太兇
  { name: '夢魘', enemyHp: 1.35, enemyDmg: 1.4, goldMult: 1.3 },
]

// ------------------------------------------------- 波次

export const MODE_WAVES: Record<Mode, number> = { quick: 10, standard: 20, endless: 20, daily: 10 }

/** 怪物密度倍率（殺光制：每波固定生出這麼多怪，全數殲滅才進下一波）。 */
export const DENSITY_MULT = 2.0

/** 放怪窗口（秒）：本波預算在這段時間內釋放完（純節奏用，不再是波次倒數）。
 *  波次何時結束＝budget 放完 + 場上清空（見 game.ts checkWaveEnd）。 */
export function spawnWindow(wave: number): number {
  return Math.min(16 + wave * 0.6, 26)
}

/** 每 5 波必有 Boss（殺 Boss 掉「首領寶箱」＝隨機大獎）：5/15/25…小 Boss、10/20/30…大 Boss（前期 10 波先給小 Boss 緩衝） */
export function isBossWave(mode: Mode, wave: number): 'mini' | 'big' | null {
  if (mode === 'quick' || mode === 'daily') return wave === 10 ? 'big' : wave === 5 ? 'mini' : null
  if (wave <= 20) {
    if (wave === 20) return 'big'
    if (wave % 5 === 0) return 'mini'   // 5 / 10 / 15
    return null
  }
  // 無盡：每 10 波大 Boss，每 5 波小 Boss
  if (wave % 10 === 0) return 'big'
  if (wave % 5 === 0) return 'mini'
  return null
}

/** 生成預算：整波要生出的「怪物點數」總量（怪物 tier 消耗 1/2/4 點）。
 *  殺光制：這就是本波的「怪物總量」，全數清光才進下一波 → ×DENSITY_MULT 加倍密度。 */
export function spawnBudget(wave: number, players: number): number {
  // 前期溫和、中後段陡升（避免第 1~2 波就被淹死，但 5 波後很硬）
  const base = 14 + wave * 8 + Math.max(0, wave - 5) * 6
  return Math.round(base * PLAYER_SCALING[players].count * DENSITY_MULT)
}

/** 怪物血量隨波數成長（另乘人數 hp、難度 enemyHp）。
 *  多段複利曲線（2026-07 大改）：前 3 波溫和 → 每波 ×1.17 → 15 波後再 ×1.25 → 25 波後再 ×1.12。
 *  設計目標：30 波小怪 ≈ 數十萬～百萬 HP、菁英數百萬；40 波 ≈ 上億 —
 *  中庸 build（純加算傷害%）15~20 波撐不住；只有疊出乘算引擎的 build 能破 40 出頭。 */
/** 全域難度倍率：怪物血量整體縮放（1.0＝基準）。歷程 0.7 →（要更難）0.85 →（2026-07-10 再 −30%）0.6。
 *  這是調整整體難度的唯一旋鈕：要更難調高、更簡單調低，sim-ttk 立刻看得到 TTK。 */
export const DIFFICULTY_HP_MULT = 0.6

export function enemyHpScale(wave: number): number {
  const linear = 1 + (wave - 1) * 0.3
  const expo = Math.pow(1.17, Math.max(0, wave - 3))
  const late = Math.pow(1.25, Math.max(0, wave - 15))
  const deep = Math.pow(1.12, Math.max(0, wave - 25))
  // 中期跳階：只有第 1 波是純暖身，第 2 波起 3 波內 ramp 到 ×10（使用者回報前 3 波太簡單，
  // 把陡升從第 4 波前移到第 2 波、抹平原本第 3→4 波的斷崖）。ramp 第 4 波封頂 → 第 6 波以後不變。
  const mid = 1 + 9 * Math.min(1, Math.max(0, (wave - 1) / 3))
  return linear * expo * late * deep * mid * DIFFICULTY_HP_MULT
}
export function enemyDmgScale(wave: number): number {
  const mid = 1 + 0.5 * Math.min(1, Math.max(0, (wave - 1) / 3))
  return (1 + (wave - 1) * 0.12) * Math.pow(1.05, Math.max(0, wave - 3)) * mid
}
/** 怪物移動速度隨波數成長（每波 +1.2%，封頂 +45%）——後期怪更快更兇 */
export function enemySpeedScale(wave: number): number {
  return Math.min(1 + wave * 0.012, 1.45)
}

/** Boss 血量隨波成長（獨立於雜魚曲線）。
 *  Boss 是單體、有機制/閃避,不該套雜魚那條「中期×10」蟲海 ramp（會變成純血牛海綿）。
 *  用平滑指數,調到:強 build 打 Boss 約 6~15 秒(有壓力但可解)、中庸 build 更吃力。
 *  取代舊的 `1 + max(0,波-10)×0.06`（幾乎不長 → Boss 一秒被秒）。 */
export function bossHpScale(wave: number): number {
  return (1 + wave * 0.6) * Math.pow(1.145, wave) * DIFFICULTY_HP_MULT
}
/** 金幣價值隨波數成長（後期商店價格上漲，收入也要跟上，否則乘算升級買不起） */
export function coinWaveMult(wave: number): number {
  return 1 + wave * 0.05
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

/** 主動技能「不吃技能傷害加成」的角色（純 buff/防禦技）：
 *  技能傷害升級/寶箱選項不該出現在這些角色身上（槍手=火力全開純攻速、戰士=盾牌衝鋒）。 */
export const NO_SKILL_DMG_ACTIVES = new Set(['rapidfire', 'bulwark', 'placeBomb'])

/** 修羅武僧「真氣」資源：擊殺凝聚，氣爆拳一次消耗全部（氣越多越痛）。 */
export const CHI = {
  max: 100,           // 真氣上限
  perKill: 6,         // 每擊殺 +6
  eliteBonus: 10,     // 菁英額外 +10
  bossBonus: 40,      // Boss 額外 +40
} as const

/** 金剛毛豆「超覺醒」：越接近死亡越強（狂戰士被動 superSurge）＋變身型爆發傷害 buff。 */
export const SURGE = {
  lowHpBonusMax: 0.6,   // 生命歸零時的最大傷害加成（+60%）
  lowHpFrom: 0.6,       // 生命低於此比例才開始加成（滿血→0，60% 血→開始長）
} as const

/** 拳王辣椒「連段」量表（comboMeter）：命中累積、閒置衰減，傷害隨連段成長；滿檔奧義變超必殺。 */
export const COMBO = {
  max: 100,
  perHit: 4,            // 每次命中 +4
  killBonus: 8,         // 擊殺額外 +8
  idleGrace: 1.4,       // 停手多久後開始衰減（秒）
  decayPerSec: 22,      // 衰減速度（/秒）
  dmgPerMeter: 0.005,   // 每點連段 +0.5% 傷害（滿檔 +50%）
} as const

// ------------------------------------------------- 玩家 / 經驗 / 復活

// 怪物密度 ×2 → 每波擊殺數約 ×2。升級曲線同步上調（約 ×1.5），讓每波升的等級數
// 與加倍前相近、避免經驗暴走；金幣則靠 coinValue 下修（見 DROPS）平衡。
export function xpForLevel(level: number): number {
  return Math.round(15 + level * 12 + level * level * 1.35)
}

export const REVIVES_PER_MODE: Record<Mode, number> = { quick: 1, standard: 2, endless: 2, daily: 1 }
export const TEAM_REVIVE = { healPct: 0.4, clearRadius: 320 }

export const DOWNED = {
  baseReviveTime: 3.0,          // 秒（單人救，站著約 3 秒救起）
  reviveTimePerDown: 0.5,       // 每次倒地 +0.5s
  maxReviveTime: 5.0,
  crawlSpeed: 40,
  reviveRadius: 105,            // 站進圈圈即施救
  revivedHpPct: 0.4,
  bleedOutTime: 45,             // 無人救援自動死亡
  multiRescuerBonus: 0.7,       // 每多 1 人救援 → 時間 ×0.7
}

// ------------------------------------------------- 效能上限（依人數）

export function caps(_players: number) {
  return {
    // 場上實體上限再壓低（不隨人數加）——多人改用「怪更壯」不「怪更多」，
    // 進一步減輕伺服器 CPU 與客戶端渲染負擔（＝更順）；怪物用 DIFFICULTY_HP_MULT 補強變壯。
    enemies: 70,
    elites: 5,
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
  coinValue: { min: 1, max: 2 },        // 密度 ×2 → 單枚金幣下修
  coinChanceMult: 0.7,                  // 全域金幣掉落機率倍率（經濟緊縮：錢要花在刀口上）
  eliteCoinBonus: 5,
  bossCoin: 60,
  heartChance: 0.018,           // 基準；乘導演 healDropMult
  heartHeal: 20,
  bigHeartHeal: 50,
  bigHeartChance: 0.2,          // 掉愛心時升級成大愛心的機率
  teamHeartChance: 0.06,        // 掉愛心時升級成團隊愛心
  teamHeartHeal: 15,
  itemChance: 0.012,
  chestChanceElite: 0.18,       // 基準；乘擊殺者幸運（開寶箱開到累 → 降頻、單顆變強、幸運 build 撿更多）
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
  priceWaveGrowth: 0.11,        // 價格隨波數上浮（經濟緊縮）
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
  radiusMin: 42,
  radiusMax: 360,               // 最大巨型陷阱 ~1/5 場地寬（1800）；偏態分佈，巨型稀有
  damage: 7,
  tickInterval: 0.8,            // 站在上面每 0.8 秒扣一次
  minDistFromCenter: 260,       // 避開出生點（巨型陷阱再依半徑外推）
  fromWave: 2,
}

// ------------------------------------------------- 任務

export const MISSION = {
  chancePerWave: 0.6,
  minWave: 4,
  killTargetScale: { 1: 1.0, 2: 1.4, 3: 1.8, 4: 2.2 } as Record<number, number>,
}

// ------------------------------------------------- 睏寶：放置炸彈系統
// 六個武器模組合成「一顆炸彈的規格」（見 game/DESIGN-kunbao.md）。
// HARD_STOCK / CHAIN_CAP 是伺服器效能與傷害溢出的護欄，不是平衡旋鈕——別為了爽拿掉。

export const BOMB = {
  cell: 64,                 // 格。炸彈對齊格心、一格一顆不重疊；火力 1 = 上下左右各炸一格
  baseFuse: 2.4,            // 基礎引信（秒）
  baseDamage: 12,
  basePower: 1,             // 基礎火力（格）
  baseStock: 1,             // 基礎同時炸彈數（＝主動技能的儲存次數）
  hardStock: 12,            // 同時炸彈硬上限（實體數／手機渲染護欄）
  armWidth: 46,             // 爆風寬度
  chainCap: 8,              // 連鎖段數上限（每段 +chainStep 傷害）
  chainStep: 0.12,
  chainHealEvery: 5,        // 每 5 段回 3% 最大生命
  chainHealPct: 0.03,
  selfPush: 850,            // 爆風把睏寶推開的力道（位移工具，不造成傷害）
  selfIframe: 0.25,
  subFuse: 0.6,             // 異常核（紅）子炸彈引信
  kickSpeed: 620,           // 踢靴：把炸彈踢出去的滑行速度
  // ── 無上限武器等級（睏寶專屬）
  // 他的武器只有六把、沒有進化，所以改成「等級沒有上限」：
  //   Lv1~4 = 白/藍/紫/紅（解鎖玩法），Lv6 / Lv8 = 額外的特殊能力里程碑，
  //   之後每一級都只給小幅數值 → 這是他無上限疊戰力的出口。
  maxLevel: 99,
  // 每一個「超過紅階」的模組等級 → 炸彈傷害 ×1.05（六把共同累乘）。
  // 刻意用**乘算**：商店價格是指數（1.28^lv），加算傷害配指數價格會讓 Lv20 之後永遠不划算，
  // 那就不叫無上限成長了。乘算之後「把六把一起 +1 級」的收益 ×1.34、成本 ×1.28 → 值得，但要花錢。
  overDmgMult: 1.05,
  powerCap: 10,             // 火力（爆風格數）硬上限：再高就是一發炸滿全場，沒有走位可言
  // 睡意
  drowsyGain: 30,           // 靜止 +/秒
  drowsyLoss: 45,           // 移動 −/秒
  wakeLock: 0.8,            // 受擊後無法累積睡意的時間
  lightAt: 40, deepAt: 80,
  lightFuse: -0.3,          // 淺眠：引信更短
  deepPower: 1,             // 熟睡：火力 +1
  deepRegenPct: 0.015,
} as const

export const drowsyTier = (d: number): 0 | 1 | 2 => (d >= BOMB.deepAt ? 2 : d >= BOMB.lightAt ? 1 : 0)

/** 模組「超過紅階」的等級數（Lv5 起算）——無上限成長的計價單位 */
export const overLevel = (lv: number): number => Math.max(0, lv - 4)
