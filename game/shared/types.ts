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
  | 'cooldown' | 'area' | 'goldGain' | 'xpGain' | 'reviveSpeed' | 'luck' | 'dodge'
  // build 擴充軸（2026-07）
  | 'flatDamage'                                        // 固定攻擊力（加在武器基礎、乘倍率之前；每發吃到）
  | 'meleeDamage' | 'rangedDamage' | 'magicDamage' | 'engineerDamage'  // 分類傷害%（依武器 category）
  | 'lifesteal'                                         // 吸血：造成傷害的 X% 轉生命
  | 'dotDamage'                                         // 持續傷害%（毒/燃燒/地面 DoT）
  | 'minionDamage'                                      // 召喚物傷害%（砲塔/無人機/地雷）
  | 'damageReduction'                                   // 傷害減免%（護甲之外的第二層）

export type StatMods = Partial<Record<StatKey, number>>

export interface ComputedStats {
  maxHp: number; armor: number; regen: number; pickupRange: number
  projectiles: number; pierce: number; lifeOnKill: number
  moveSpeed: number; damage: number; attackSpeed: number
  critChance: number; critDamage: number; cooldown: number; area: number
  goldGain: number; xpGain: number; reviveSpeed: number; luck: number
  dodge: number             // 閃避率 0~0.7（命中前擲骰，成功＝完全免傷）
  flatDamage: number        // 固定攻擊力（加在武器基礎、乘傷害倍率之前）
  meleeDamage: number; rangedDamage: number; magicDamage: number; engineerDamage: number  // 分類傷害%
  lifesteal: number         // 吸血率 0~0.5（造成傷害 × 此值回血）
  dotDamage: number         // 持續傷害加成%
  minionDamage: number      // 召喚物傷害加成%
  damageReduction: number   // 傷害減免% 0~0.5（護甲之外第二層）
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
  /** 配裝格數（gear 欄位上限）。省略＝6（舊行為）。主動型角色未來砍成 3，睏寶炸彈模組維持 6。
   *  資料驅動：改格數＝改這個數字，不影響其他角色。同一 gear 家族內須一致，跨家族不可比。 */
  slots?: number
  /** 隱藏：選角畫面不顯示（重構期用來藏「還沒改完」的角色，一批一批上線）。 */
  hidden?: boolean
  /** 專屬 gear 制：商店只出「自己的 gear（charId 綁本人）＋共通被動」，不出共用池武器。
   *  已重構到新配裝制的角色設 true（睏寶靠 dreamFuse 判定、不需此旗標）。 */
  exclusiveGear?: boolean
  /** 配裝格的顯示名（每角色可不同）：武僧＝技能、睏寶＝模組、未來汽車人＝零件。省略＝武器。 */
  slotLabel?: string
  unlockCondition?: string
  rarity: 'common' | 'rare' | 'epic'
  /** 程式化美術主色盤 [body, accent, leaf] */
  palette: [string, string, string]
}

export type WeaponBehavior =
  | 'projectile' | 'orbit' | 'chain' | 'mine' | 'turret'
  | 'healPulse' | 'zone' | 'drone' | 'melee'
  /** 睏寶專屬：不自己開火，六個模組合成「一顆炸彈的規格」（server bombs.ts buildSpec） */
  | 'bombModule'

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
  /** 「階級上限」：perLevel 表與進化的門檻（不是等級上限——等級沒有上限） */
  maxLevel: number
  /** 真正的等級上限（未設 = 無上限）。只有數值本身有硬天花板的武器才需要，例如睏寶的彈藥箱：
   *  炸彈數受 hardStock 與引信長度限制，升再高也放不出更多顆。 */
  levelCap?: number
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
  | 'kiter' | 'charger' | 'looter' | 'stalker' | 'orbiter'

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

/** 寶箱 boon：開箱三選一的「永久戰力」——build 成形的主要來源（武器/復活碎片已移出寶箱）。
 *  statMods = 永久屬性加成（疊加到 SPlayer.boonMods）；effect = 特殊效果（server 實作）。 */
export interface ChestBoonData {
  id: string
  name: string
  detail: string
  weight: number
  statMods?: StatMods
  /** dmgMult=傷害×params.mult（乘算） / weaponUp / allWeaponUp / gold / epicUpgrade / curse / skillPower / skillCd
   *  / waveShield（每波開場護盾） / fullHeal / skillBoost / richGold（首領寶箱用） */
  effect?: string
  params?: Record<string, number>
  /** 高價值選項：出現權重乘上玩家幸運（讓幸運 build 有感） */
  shiny?: boolean
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
  spd?: number            // 目前移動速度（含 buff）——client 自機預測用（升級移速才會真的變快）
  fx?: string             // 短暫狀態: 'dash'|'rage'|...
  dz?: number             // 睏寶睡意 0~100（client 畫睡意環／Zzz）
  sc?: number; smc?: number   // 睏寶技能儲存次數 / 上限（＝還能放幾顆炸彈）
  chi?: number            // 修羅武僧真氣 0~100（client 畫氣量表；氣爆拳消耗）
}

/** 生成時一次送 full spawn（game:ev），之後快照只送位置與血量 */
export interface EnemySnap {
  i: number; x: number; y: number; h: number; f?: number
  /** ENEMIES 索引 + 菁英/體型。快照必須自帶這些，client 才能在漏收 spawn 事件時自行補建，
   *  否則那隻怪會「存在於 server、永遠不被畫出來」＝隱形怪（會咬人、也打得到）。 */
  k: number; e?: 1; sz?: number
}
/** f bitflags: 1=shielded 2=frozen 4=slowed 8=enraged 16=confused 32=cloaked（隱形，client 畫微光殘影） */

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
  x2?: 1                         // ×2 金幣（上一波沒吃到的補償，樣式加大）
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
export interface ZoneSnap { x: number; y: number; r: number; k: 'poison' | 'heal' | 'fire' | 'frost' | 'spike' | 'haze' | 'shield'; h?: 1 }   // h=1 對玩家有害（危險，畫紅）
export interface MineSnap { x: number; y: number; r: number; a?: 1 }   // a=已佈署完成（可觸發）
/** 睏寶的放置炸彈：f=引信剩餘比例 0~1、r=爆風臂長、x=X型斜臂、s=子炸彈 */
export interface BombSnap { x: number; y: number; f: number; r: number; x2?: 1; s?: 1; l?: 1 }   // l=橫掃（只有左右兩臂）


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
  bombs?: BombSnap[]                   // 睏寶的放置炸彈
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
  | { t: 'pmiss'; id: string }                              // 玩家閃避（迴避成功、完全免傷）
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
