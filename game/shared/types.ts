// 菜菜勇者團 — 共用型別（前後端唯一事實來源）。
// 所有內容表 schema 與執行期狀態都定義在這裡；內容本身在 ./content/*。

// ---------------------------------------------------------------- 基本列舉

export type Mode = 'quick' | 'standard' | 'endless' | 'daily'
export type RoomPhase = 'lobby' | 'select' | 'combat' | 'intermission' | 'gameover'
export type PlayerStatus = 'alive' | 'downed' | 'dead' | 'disconnected'
export type IntermissionStep = 'settlement' | 'levelup' | 'shop' | 'route'
export type Rarity = 'common' | 'rare' | 'epic' | 'legendary' | 'cursed'

// ---------------------------------------------------------------- 數值系統
// StatMods 的語意（stats.ts 依此合成，勿在別處各自解讀）：
//   加法：maxHp armor regen pickupRange projectiles pierce lifeOnKill
//   百分比加法（0.1 = +10%）：其餘全部
export type StatKey =
  | 'maxHp' | 'armor' | 'regen' | 'pickupRange' | 'projectiles' | 'pierce' | 'lifeOnKill'
  | 'moveSpeed' | 'damage' | 'attackSpeed' | 'critChance' | 'critDamage'
  | 'cooldown' | 'area' | 'goldGain' | 'xpGain' | 'reviveSpeed' | 'luck'

export type StatMods = Partial<Record<StatKey, number>>

export interface ComputedStats {
  maxHp: number; armor: number; regen: number; pickupRange: number
  projectiles: number; pierce: number; lifeOnKill: number
  moveSpeed: number; damage: number; attackSpeed: number
  critChance: number; critDamage: number; cooldown: number; area: number
  goldGain: number; xpGain: number; reviveSpeed: number; luck: number
}

// ---------------------------------------------------------------- 內容 schema

export interface CharacterData {
  id: string
  name: string
  description: string
  role: 'tank' | 'dps' | 'support' | 'engineer' | 'control' | 'gambler'
  baseStats: {
    maxHp: number; armor: number; moveSpeed: number; damage: number
    attackSpeed: number; critChance: number; critDamage: number
    pickupRange: number; regen: number
  }
  /** 被動：純數值走 mods，特殊行為走 effect id（server combat.ts 實作） */
  passive: { description: string; mods?: StatMods; effect?: string }
  active: {
    id: string; name: string; description: string
    cooldown: number
    params?: Record<string, number>
  }
  /** 若指定，此角色只能裝備該類別武器（例：反甲坦克只能拿 melee） */
  weaponClass?: WeaponCategory
  /** 親和 tag：商店/福袋/寶箱抽武器時，帶這些 tag 的武器權重提高（角色風格傾向，非硬限制） */
  affinityTags?: string[]
  /** 初始武器三選一（簽名武器＋親和推薦） */
  startWeapons: string[]
  unlockCondition?: string
  rarity: 'common' | 'rare' | 'epic'
  /** 程式化美術主色盤 [body, accent, leaf] */
  palette: [string, string, string]
}

export type WeaponBehavior =
  | 'projectile' | 'orbit' | 'chain' | 'mine' | 'turret'
  | 'healPulse' | 'zone' | 'drone' | 'melee'

export type WeaponCategory = 'melee' | 'ranged' | 'magic' | 'engineer' | 'support' | 'summon'

export interface WeaponStats {
  damage: number
  cooldown: number        // 秒
  range: number
  projectileCount: number
  pierce: number
  knockback: number
  speed?: number          // 投射物速度
  radius?: number         // 爆炸 / 區域 / 環繞半徑
  duration?: number       // 區域 / 砲塔 / 地雷存活秒數
  slow?: number           // 減速比例 0~1
  freezeChance?: number
  chains?: number         // 閃電連鎖數
  heal?: number
  burn?: number           // 每秒持續傷害（毒/燃燒區域）
}

export interface WeaponData {
  id: string
  name: string
  category: WeaponCategory
  behavior: WeaponBehavior
  description: string
  base: WeaponStats
  /** 每升 1 級的加法增量（未列 = 不變） */
  perLevel: Partial<WeaponStats>
  maxLevel: number
  critModifier?: number
  specialEffect?: string
  /** 武器專屬機制（每把武器的「特色」）：id 對應 server combat.ts / enemies.ts 的 hook，params 為數值參數。
   *  未知 id 安全忽略 → 加機制 = combat 寫一次 hook，之後全是資料。 */
  mech?: { id: string; params?: Record<string, number> }
  tags: string[]
  price: number           // 商店基準價（隨波數上浮）
  tier: 1 | 2 | 3
  /** 滿級後，若玩家擁有 requires（升級 id 或任一已持有升級的 tag），自動進化成 into 這把武器 */
  evolution?: { requires: string; into: string }
  /** 進化型武器：不會出現在商店/寶箱池，只能由進化取得 */
  evolvedForm?: boolean
  /** 專屬角色 id：只有該角色的商店/升級/寶箱會出現此武器（共通道具不設此欄） */
  charId?: string
  palette: [string, string]
}

export type UpgradeCategory =
  | 'stat' | 'weapon' | 'coop' | 'character' | 'curse' | 'legendary' | 'set'

export interface UpgradeData {
  id: string
  name: string
  description: string
  rarity: Rarity
  category: UpgradeCategory
  statMods?: StatMods
  /** 非純數值效果 id（server 實作；未知 id 安全忽略） */
  specialEffect?: string
  tags: string[]
  weight: number
  maxStacks: number
  /** 需求：角色 id / 武器 tag（'char:tank01' | 'weaponTag:explosive'） */
  requirements?: string[]
  conflicts?: string[]
  price: number
}

export type EnemyBehavior =
  | 'chase' | 'fast' | 'tank' | 'ranged' | 'exploder'
  | 'shielded' | 'summoner' | 'toxic' | 'lunger' | 'thief'
  | 'kiter' | 'charger' | 'looter'

export interface EnemyData {
  id: string
  name: string
  baseHp: number
  speed: number
  damage: number
  radius: number
  scoreValue: number
  coinChance: number      // 0~1
  xpSize: 1 | 2 | 3       // 小/中/大經驗球
  behavior: EnemyBehavior
  attackPattern?: string
  params?: Record<string, number>   // shootCd / lungeCd / summonCd / fuse ...
  tags: string[]
  tier: 1 | 2 | 3         // 普通 / 特殊 / 菁英底
  minWave: number
  palette: [string, string]
}

export interface AffixData {
  id: string
  name: string
  hpMult?: number
  speedMult?: number
  damageMult?: number
  damageReduction?: number       // 0~1
  sizeMult?: number
  onDeath?: 'split' | 'explode'
  trail?: 'poison'
  periodicShield?: number        // 每 N 秒獲得護盾
  targetLowestHp?: boolean
  weight: number
  color: string                  // 客戶端光環色
}

export interface BossPhaseData {
  /** 血量低於此比例進入本階段 */
  untilHpPct: number
  skills: string[]               // boss.ts 技能 handler id
  skillInterval: number
}

export interface BossData {
  id: string
  name: string
  title: string
  baseHp: number
  speed: number
  radius: number
  damage: number
  phases: BossPhaseData[]
  /** 技能參數表，key = 技能 id */
  skillParams: Record<string, Record<string, number>>
  summonTable?: { id: string; w: number }[]
  /** 合作機制說明（顯示用）+ 依人數縮放在 boss.ts */
  cooperation: string
  rewardGold: number
  rewardXp: number
  tier: 'mini' | 'big'
  palette: [string, string, string]
}

export interface ZoneData {
  id: string
  name: string
  description: string
  enemyPool: { id: string; w: number; fromWave?: number }[]
  props: ('barrel' | 'bush' | 'healHerb' | 'coinBox' | 'crate' | 'mushroom')[]
  propCount: number
  bg: { top: string; bottom: string; accent: string }
  musicMood: 'farm' | 'forest' | 'market'
}

export interface EventData {
  id: string
  name: string
  description: string
  /** 0 = 增益/中性，1 = 高危（平衡規則管制連續出現） */
  danger: 0 | 1
  weight: number
  minWave: number
  /** 純數值修飾 */
  mods?: {
    coinMult?: number; enemySpeedMult?: number; rewardMult?: number
    chestBonus?: number; eliteChanceMult?: number; shopDiscount?: number
    dropMult?: number
  }
  /** 需要 tick 邏輯的 hook id（events in game.ts：edgePoison / darkness / lightning / fireFloor / healFountain） */
  hook?: string
}

export type MissionType =
  | 'survive' | 'kills' | 'elite' | 'crystal' | 'cart' | 'points'
  | 'orbs' | 'nests' | 'base' | 'chestGuard'

export interface MissionData {
  id: string
  type: MissionType
  name: string
  /** {n} 會替換為縮放後目標數 */
  descTemplate: string
  baseTarget: number
  /** count = 依人數乘 objectiveMult；objects = 依人數查表（機關數） */
  scalingMode: 'count' | 'objects'
  rewards: ('gold' | 'freeUpgrade' | 'teamHeal' | 'shopDiscount' | 'rareBoost' | 'chest' | 'reviveShard')[]
  minWave: number
}

export interface ItemData {
  id: string
  name: string
  emoji: string
  description: string
  /** drops.ts 效果 id */
  effect: string
  params?: Record<string, number>
  weight: number
}

export interface ChestRewardData {
  id: string
  name: string
  type: 'gold' | 'weapon' | 'weaponUp' | 'upgrade' | 'teamItem' | 'reviveShard' | 'curse'
  weight: number
}

export interface RouteData {
  id: string
  name: string
  reward: string
  risk: string
  mods: {
    goldMult?: number; rareChance?: number; chestMult?: number
    eliteForce?: boolean; enemyCountMult?: number; rangedBias?: number
    poisonEdges?: boolean; specialShop?: boolean; rewardMult?: number
  }
  weight: number
}

export interface TeamShopItemData {
  id: string
  name: string
  description: string
  price: number
  /** shop.ts 效果 id */
  effect: string
  params?: Record<string, number>
  once?: boolean
}

export interface TeamRewardData {
  id: string
  name: string
  description: string
  effect: string
  params?: Record<string, number>
}

// ---------------------------------------------------------------- 房間 / 玩家

export interface RoomConfig {
  mode: Mode
  difficulty: number      // 0 起，可擴充 10 級（balance.ts difficultyMods）
  maxPlayers: number      // 1~4
}

export interface RoomPlayer {
  id: string
  name: string
  charId: string | null
  weaponId: string | null
  ready: boolean
  connected: boolean
  isHost: boolean
}

export interface RoomInfo {
  code: string
  phase: RoomPhase
  hostId: string
  config: RoomConfig
  players: RoomPlayer[]
  wave: number
  started: boolean
}

// ---------------------------------------------------------------- 戰鬥快照（10Hz，短鍵省流量）

export interface PlayerSnap {
  id: string
  x: number; y: number
  hp: number; mhp: number
  st: PlayerStatus
  lv: number
  sh: number              // 護盾
  rp: number              // 被救援進度 0~1
  cd: number              // 技能剩餘冷卻（秒）
  gold: number
  xp: number; nxp: number // 目前經驗 / 升級所需
  dn: number              // downedCount
  pu: number              // 待選升級數
  dmg: number             // 整局累計總傷害量
  fx?: string             // 短暫狀態: 'dash'|'rage'|...
}

/** 生成時一次送 full spawn（game:ev），之後快照只送位置與血量 */
export interface EnemySnap { i: number; x: number; y: number; h: number; f?: number }
/** f bitflags: 1=shielded 2=frozen 4=slowed 8=enraged */

export interface EnemySpawnEv {
  i: number; k: string          // EnemyData id
  x: number; y: number
  mhp: number
  e?: 1                          // 菁英
  a?: string[]                   // 詞綴 id
  sz?: number                    // sizeMult
}

export interface DropSpawnEv {
  i: number
  t: 'xp' | 'coin' | 'heart' | 'item' | 'chest' | 'orb' | 'shard'
  x: number; y: number
  v?: number                     // xp 量級 / 金幣值 / 愛心大小
  it?: string                    // ItemData id
}

export interface ObjectiveSnap {
  i: number
  t: 'crystal' | 'cart' | 'point' | 'nest' | 'rune' | 'pillar' | 'base' | 'guardChest' | 'prop' | 'trap'
  x: number; y: number
  hp?: number; mhp?: number
  pg?: number                    // 進度 0~1（踩點/符文）
  r: number
  s?: number                     // state: 0 未啟動 1 啟動中 2 完成/破壞
  k?: string                     // prop 種類
}

export interface BossSnap {
  id: string
  x: number; y: number
  hp: number; mhp: number
  ph: number                     // 階段 index
  cast?: { s: string; until: number; x?: number; y?: number; ang?: number }
  sh?: number                    // 護盾
  stun?: number
}

// 場上「部署物」——砲塔/地面圈/地雷（持續存在於 server，需每快照送位置才畫得出來）
export interface TurretSnap { x: number; y: number; g?: 1 }   // g=守護型（優先護隊友）
export interface ZoneSnap { x: number; y: number; r: number; k: 'poison' | 'heal' | 'fire' | 'frost' | 'spike' | 'haze'; h?: 1 }   // h=1 對玩家有害（危險，畫紅）
export interface MineSnap { x: number; y: number; r: number; a?: 1 }   // a=已佈署完成（可觸發）

export interface Snapshot {
  t: number                      // server 時間（秒，本波起算）
  left: number                   // 波剩餘秒（殺光制下＝0，改用 spawning + counts.enemies）
  spawning?: 1                   // 本波仍在放怪（budget 未耗盡）
  players: PlayerSnap[]
  enemies: EnemySnap[]
  objectives: ObjectiveSnap[]
  boss?: BossSnap
  eProj?: { x: number; y: number }[]   // 敵方彈幕（視覺 + 客戶端閃避判讀用，命中仍在 server）
  turrets?: TurretSnap[]               // 部署中的砲塔
  zones?: ZoneSnap[]                   // 地面圈（治療/毒/火/冰）
  mines?: MineSnap[]                   // 地雷
  director: { pressure: number; level: number }
  mission?: { name: string; progress: number; target: number; done: boolean; failed?: boolean }
  event?: string                 // 事件 id
  teamRevives: number
  counts: { enemies: number; elites: number; drops: number }
}

// ---------------------------------------------------------------- 戰鬥事件（即時批次）

export type GameEv =
  | { t: 'spawn'; e: EnemySpawnEv }
  | { t: 'despawn'; i: number }
  | { t: 'kill'; i: number; x: number; y: number; by?: string }
  | { t: 'hit'; i: number; d: number; crit?: 1; x: number; y: number }
  | { t: 'phit'; id: string; d: number }                    // 玩家受擊
  | { t: 'shoot'; id: string; w: string; x: number; y: number; tx: number; ty: number; n: number }
  | { t: 'drop'; d: DropSpawnEv }
  | { t: 'pick'; i: number; id: string }
  | { t: 'lvup'; id: string; lv: number }
  | { t: 'down'; id: string }
  | { t: 'revive'; id: string; by?: string }
  | { t: 'teamRevive' }
  | { t: 'dead'; id: string }
  | { t: 'skill'; id: string; s: string; x?: number; y?: number }
  | { t: 'item'; id: string; it: string }
  | { t: 'chestOpen'; x: number; y: number; reward: string }
  | { t: 'objSpawn'; o: ObjectiveSnap }
  | { t: 'objRemove'; i: number }
  | { t: 'bossSpawn'; id: string; name: string; title: string; mhp: number }
  | { t: 'bossSkill'; s: string; x?: number; y?: number; ang?: number }
  | { t: 'bossDead' }
  | { t: 'aoe'; x: number; y: number; r: number; kind: string; w?: string; id?: string }  // w=武器 id（揮砍上色）；id=施放玩家 id（揮砍動畫）
  | { t: 'toast'; msg: string; kind?: 'info' | 'warn' | 'good' }

// ---------------------------------------------------------------- 中場（結算/升級/商店/路線）

export interface WaveSettlement {
  wave: number
  missionDone: boolean
  perPlayer: Record<string, {
    kills: number; gold: number; xp: number; dmgTaken: number
    rescues: number; downs: number; dmg: number
  }>
  teamGrade: 'S' | 'A' | 'B' | 'C'
  rewards: string[]
}

export interface UpgradeOffer {
  offerId: string
  upgradeId: string
  rarity: Rarity
}

export interface ShopOffer {
  offerId: string
  kind: 'weapon' | 'upgrade' | 'item' | 'mystery'
  refId: string                 // weapon id / upgrade id / item id（mystery 為空）
  price: number
  locked: boolean
  sold: boolean
  weaponLevel?: number
  startLevel?: number           // 後期波數：新武器直接以較高等級入手（未持有時的起始等級）
  origPrice?: number            // 特價時的原價（顯示刪除線）
}

export interface ShopView {
  offers: ShopOffer[]
  refreshCost: number
  discount: number
}

/** 團隊獎勵（免費多選）：每人可選 picksPerPlayer 個，picks 記錄每人已選的選項 id */
export interface TeamRewardView {
  options: { id: string; name: string; description: string }[]
  picks: Record<string, string[]>
  picksPerPlayer: number
}

export interface RouteOffer { routeId: string; votes: string[] }

export interface ChestPending { chestId: string; options: { rewardId: string; detail: string; refId?: string }[] }

/** per-player 個人化的中場視圖（server 對每個 socket 各別發送） */
export interface IntermissionView {
  step: IntermissionStep
  wave: number
  nextWave: number
  settlement: WaveSettlement
  pendingLevelups: number
  levelupChoices: UpgradeOffer[]
  chests: ChestPending[]
  shop: ShopView
  routes: RouteOffer[]
  teamReward?: TeamRewardView
  readySet: string[]
  gold: number
  me: { weapons: { id: string; level: number }[]; upgrades: string[]; stats: ComputedStats }
  bossNext: boolean
}

export interface GameOverSummary {
  victory: boolean
  wave: number
  mode: Mode
  totalKills: number
  duration: number
  perPlayer: WaveSettlement['perPlayer']
  bestWave?: number
}

// ---------------------------------------------------------------- Debug

export interface DebugState {
  wave: number; players: number; avgHpPct: number; teamDps: number
  enemies: number; elites: number; drops: number
  pressure: number; directorLevel: number
  spawnMult: number; healDropMult: number
  event: string; missionProgress: string
  tickMs: number
}

export type DebugCmd =
  | { c: 'skipWave' } | { c: 'gold'; n: number } | { c: 'xp'; n: number }
  | { c: 'spawn'; id: string; n: number } | { c: 'boss'; id: string }
  | { c: 'pressure'; n: number } | { c: 'scale'; players: number }
  | { c: 'reset' } | { c: 'god' }
