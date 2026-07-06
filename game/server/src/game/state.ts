// 伺服器端執行期狀態型別（不對外傳輸；傳輸格式見 shared/types 的 Snap/Ev）。
import type {
  CharacterData, EnemyData, AffixData, BossData, ComputedStats,
  PlayerStatus, WeaponData, MissionData, EventData, RouteData,
  ShopOffer, ChestPending,
} from '../../../shared/types'

export interface OwnedWeapon {
  data: WeaponData
  level: number
  cdLeft: number
  orbitAngle: number
  hitMemo: Map<number, number>   // orbit/melee 對每隻怪的命中冷卻（enemyIdx → time）
}

export interface Buffs {
  hasteUntil: number; hasteAmt: number
  rageUntil: number; rageAmt: number
  invulnUntil: number
  shieldNextWave: number
}

export interface WaveStat {
  kills: number; gold: number; xp: number; dmgTaken: number
  rescues: number; downs: number; dmgDealt: number
}

export interface SPlayer {
  id: string
  name: string
  token: string
  socketId: string | null
  connected: boolean
  disconnectAt: number

  char: CharacterData
  weapons: OwnedWeapon[]
  upgrades: Map<string, number>          // upgradeId → stacks
  effects: Map<string, number>           // specialEffect id → stacks（由 upgrades 推導）

  x: number; y: number
  lastX: number; lastY: number
  status: PlayerStatus
  hp: number
  shield: number
  gold: number
  xp: number
  level: number
  pendingLevelups: number
  stats: ComputedStats

  skillCdLeft: number
  skillCharges: number
  skillMaxCharges: number
  buffs: Buffs
  dashUntil: number; dashVx: number; dashVy: number

  downedCount: number
  reviveProgress: number                 // 0~1
  bleedOutAt: number
  lastHitAt: number                      // 最近受擊時間（救援中斷判定）
  fogTick: number                        // Boss 毒霧傷害節拍
  usedPhoenix: boolean
  usedFirstDownRevive: boolean
  eliteTrophyStacks: number
  pulseTimer: number
  regenTick: number

  reviveShards: number
  soloRevives: number                    // 單人模式自動復活次數
  chestKeyBonus: number                  // 寶箱鑰匙道具 → 開箱選項 +1

  wave: WaveStat
  total: WaveStat
  god: boolean

  // 中場個人狀態
  shopOffers: ShopOffer[]
  refreshCount: number
  levelupChoices: { offerId: string; upgradeId: string }[]
  chests: ChestPending[]
  pendingItems: string[]                 // 商店買的臨時道具（下一波開場生效）
  interReady: boolean
  fx: string                             // 短暫視覺狀態
  fxUntil: number
}

export interface SEnemy {
  i: number
  data: EnemyData
  x: number; y: number
  hp: number; maxHp: number
  speed: number; damage: number
  radius: number
  dr: number                             // 詞綴減傷
  affixes: AffixData[]
  elite: boolean
  sizeMult: number
  shield: number
  frozenUntil: number
  slowUntil: number; slowPct: number
  stunUntil: number
  kbVx: number; kbVy: number
  touchCd: number
  // 行為狀態
  actCd: number                          // shoot/lunge/summon 共用計時
  fuse: number                           // exploder 觸發倒數（-1 = 未觸發）
  fleeUntil: number
  stolenGold: number
  lungeVx: number; lungeVy: number; lungeUntil: number
  shieldTick: number
  trailTick: number
  targetId: string | null
  splitChild: boolean
  burnDps: number; burnUntil: number
}

export interface SProjectile {
  x: number; y: number; vx: number; vy: number
  damage: number; pierce: number; knockback: number
  left: number                            // 剩餘飛行距離
  ownerId: string
  weaponId: string
  crit: boolean
  explodeRadius: number
  slow: number; slowDur: number; freezeChance: number
  hitSet: Set<number>
}

export interface SEnemyProj {
  x: number; y: number; vx: number; vy: number; damage: number; left: number
}

export interface SZone {
  x: number; y: number; radius: number
  dps: number; hps: number
  until: number
  ownerId: string | null
  kind: 'poison' | 'heal' | 'fire' | 'frost'
  hostile: boolean                        // 對玩家有害
  tick: number
}

export interface SMine {
  x: number; y: number; radius: number; damage: number
  until: number; armAt: number; ownerId: string; weaponId: string
}

export interface STurret {
  x: number; y: number; damage: number; range: number
  fireCd: number; cdLeft: number; until: number; ownerId: string
  guard: boolean                          // 優先保護隊友
}

export interface SDrop {
  i: number
  t: 'xp' | 'coin' | 'heart' | 'item' | 'chest' | 'orb' | 'shard'
  x: number; y: number
  v: number
  item?: string
  magnetTargetId: string | null
  bornAt: number
}

export interface SObjective {
  i: number
  t: 'crystal' | 'cart' | 'point' | 'nest' | 'rune' | 'pillar' | 'base' | 'guardChest' | 'prop' | 'trap'
  x: number; y: number
  hp: number; maxHp: number
  pg: number
  r: number
  s: number                               // 0 未啟動 / 1 進行中 / 2 完成或摧毀
  k?: string                              // prop 種類
  tick: number
  path?: { x: number; y: number }[]       // cart 路徑
  pathIdx?: number
}

export interface SBoss {
  data: BossData
  x: number; y: number
  hp: number; maxHp: number
  phaseIdx: number
  skillTimer: number
  skillQueue: string[]
  casting: { skill: string; until: number; x?: number; y?: number; ang?: number } | null
  shield: number
  stunUntil: number
  chargeVx: number; chargeVy: number; chargeUntil: number
  runeIdxs: number[]                      // 啟動中的符文 objective idx
  frontAng: number
  touchCd: number
}

export interface MissionRt {
  data: MissionData
  target: number
  progress: number
  done: boolean
  failed: boolean
  guardTimer: number
}

export interface EventRt {
  data: EventData
  tick: number
}

export interface RouteMods {
  goldMult: number; rareChance: number; chestMult: number
  eliteForce: boolean; enemyCountMult: number; rangedBias: number
  poisonEdges: boolean; specialShop: boolean; rewardMult: number
  dropMult: number; shieldOnStart: number; shopDiscount: number
}

export const defaultRouteMods = (): RouteMods => ({
  goldMult: 1, rareChance: 0, chestMult: 0, eliteForce: false,
  enemyCountMult: 1, rangedBias: 0, poisonEdges: false, specialShop: false,
  rewardMult: 1, dropMult: 1, shieldOnStart: 0, shopDiscount: 0,
})

export interface TeamState {
  revives: number
  revivesBought: number
  reviveShards: number
  bossDamage: number                      // 對 Boss 傷害加成
  objectiveHp: number                     // 任務目標生命加成
  teamShopBought: Set<string>
  teamShopVotes: Map<string, Set<string>>
  reviveVotes: Set<string>
}
