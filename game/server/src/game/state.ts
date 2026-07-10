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
  // mech 執行期狀態
  counter: number                // comboNova / critEvery 的擊發計數
  heat: number                   // spinUp 熱度（0~max）
  frenzyUntil: number            // frenzyKill 狂熱結束時間
}

/** 建立 OwnedWeapon（game.ts 開局與 shop.ts addWeapon 共用，避免欄位漏初始化） */
export function newOwnedWeapon(data: WeaponData, orbitAngle = 0): OwnedWeapon {
  return { data, level: 1, cdLeft: 0, orbitAngle, hitMemo: new Map(), counter: 0, heat: 0, frenzyUntil: 0 }
}

export interface Buffs {
  hasteUntil: number; hasteAmt: number
  rageUntil: number; rageAmt: number
  critUntil: number; critAmt: number   // 暴擊率 buff（賭徒幸運爆發等）
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
  // 寶箱 boon（永久戰力，與 upgrades 分開記；stats.ts 折算）
  boonMods: Partial<Record<string, number>>   // StatKey → 累計加成
  boonDmgMult: number                    // 乘算傷害（狂暴基因 ×1.3 疊乘）
  boonSkillPower: number                 // 技能傷害 +35%/層
  boonSkillCd: number                    // 技能冷卻 -10%/層
  boonWaveShield: number                 // 每波開場護盾（甲殼共生/聖盾祝福累積）

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
  bulwarkUntil: number; bulwarkVx: number; bulwarkVy: number   // 戰士盾牌衝鋒（減傷+推進）
  stillT: number                         // 連續靜止秒數（睏寶被動 sleepGuard）
  sleeping: boolean                      // 沉睡中（額外減傷；受擊/移動即醒）

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
  confusedUntil: number                  // 迷幻（大麻）：亂走、不攻擊
  kbVx: number; kbVy: number
  touchCd: number
  // 行為狀態
  actCd: number                          // shoot/lunge/summon 共用計時
  fuse: number                           // exploder 觸發倒數（-1 = 未觸發）
  fleeUntil: number
  stolenGold: number
  lungeVx: number; lungeVy: number; lungeUntil: number
  windupUntil: number                    // charger 衝刺前蓄力預警
  lootDropCd: number                     // looter 被打噴金幣節流
  shieldTick: number
  trailTick: number
  targetId: string | null
  splitChild: boolean
  burnDps: number; burnUntil: number
  markedUntil: number; markMult: number   // 倒鉤鏢標記：期間內受到所有來源傷害 ×markMult
  cloaked: boolean                        // stalker：隱形中（自動瞄準鎖不到、client 畫殘影）
  ringTick: number                        // orbiter：刺球環傷害節拍
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
  // 武器 mech（split 子彈不繼承 mech，避免無限分裂）
  mechId?: string
  mechP?: Record<string, number>
  initLeft: number                        // 出膛時的 left（rangeRamp/closeRamp 用）
  bounces: number                         // wallBounce 剩餘反彈數
  jumps: number                           // ricochet 剩餘彈射數
}

export interface SEnemyProj {
  x: number; y: number; vx: number; vy: number; damage: number; left: number
}

export interface SZone {
  x: number; y: number; radius: number
  dps: number; hps: number
  until: number
  ownerId: string | null
  kind: 'poison' | 'heal' | 'fire' | 'frost' | 'spike' | 'haze'
  hostile: boolean                        // 對玩家有害
  tick: number
  // 武器 mech 分化（zone 四把四種玩法）
  stack?: boolean                         // stackDot：毒素疊加（burnDps 累加而非取 max）
  slowPct?: number; freeze?: number       // frostZone：圈內減速 + 每 tick 凍結機率
  ramp?: number                           // rampZone：dps 每 0.5s 遞增比例
  pulseKb?: number                        // pulseZone：每 tick 擊退力道
  born?: number                           // rampZone 起算時間
}

export interface SMine {
  x: number; y: number; radius: number; damage: number
  until: number; armAt: number; ownerId: string; weaponId: string
  // 十字爆風（睏寶的水球炸彈 / 爆爆睡）：cross=臂長，crossW=爆風寬度
  cross?: number; crossW?: number
  slow?: number; slowDur?: number
  fuse?: boolean                          // true = 定時引爆（不靠怪物觸發）
  knockback?: number
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
  x2?: boolean                            // ×2 金幣（上一波沒吃到的補償）
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
  waveShield: number                      // 每波開場永久護盾（團隊獎勵累積）
}
