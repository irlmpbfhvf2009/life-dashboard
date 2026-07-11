// 一場遊戲的權威狀態機：20Hz tick、波次流程、倒地救援、團隊復活、
// 中場（結算/升級/商店/路線投票）、快照廣播、Debug 指令。
import type {
  Mode, GameEv, Snapshot, IntermissionView, WaveSettlement,
  GameOverSummary, DebugCmd, DebugState, RoomConfig,
} from '../../../shared/types'
import {
  ARENA, TICK_HZ, SNAP_HZ, PLAYER_SCALING, MODE_WAVES, spawnWindow,
  isBossWave, spawnBudget, REVIVES_PER_MODE, TEAM_REVIVE, DOWNED,
  caps as capsOf, EVENT_RULES, xpForLevel, COMBO,
} from '../../../shared/balance'
import {
  CHARACTER_MAP, WEAPON_MAP, ZONES, ZONE_MAP, ZONE_ORDER, EVENTS,
  ROUTES, BOSS_ROTATION, UPGRADE_MAP, ENEMIES,
} from '../../../shared/content/index'

/** 怪種 id → ENEMIES 索引（快照用數字傳，省頻寬） */
const ENEMY_INDEX = new Map(ENEMIES.map((e, i) => [e.id, i]))
import type { EventData, Rarity } from '../../../shared/types'
import { mulberry32, hashSeed, dailySeed, weightedR, shuffleR } from '../../../shared/rng'
import type {
  SPlayer, SEnemy, SProjectile, SEnemyProj, SZone, SMine, STurret,
  SDrop, SObjective, SBoss, MissionRt, EventRt, RouteMods, TeamState, WaveStat,
  SBomb,
} from './state'
import { defaultRouteMods, newOwnedWeapon } from './state'
import { bombsOnWaveStart, bombsDeathSave, drowsyTick, drowsyDr, wakeUp, kunbaoSkill, isKunbao } from './bombs'
import { dist2, norm, clamp, clampArena } from './util'
import { recomputeEffects, eff } from './stats'
import { newDirector, directorTick, spawnMult, healDropMult, type DirectorState } from './director'
import { weaponsTick, enemyProjsTick } from './combat'
import { spawnerTick, enemiesTick, spawnEnemy, edgeSpawnPos, damageEnemyImpl } from './enemies'
import { spawnBoss, bossTick, damageBoss } from './boss'
import { dropsTick, vacuumAll, spawnDrop, healPlayer, applyItem, gainGold, gainXp } from './drops'
import {
  rollMission, setupMission, missionTick, grantMissionRewards,
  eventTick, setupEventObjects, strikesTick, spawnProps, spawnTraps, trapsTick, onPropDestroyed, removeObjective,
} from './missions'
import {
  rollLevelupChoices, applyUpgrade, generateShopOffers, buyOffer, refreshShop,
  sellWeapon, addWeapon, applyChestChoice,
  rollTeamRewardOptions, applyTeamReward, teamRewardPicksPerPlayer, checkEvolutions,
} from './shop'

export interface GameHost {
  /** 廣播給整個房間 */
  emit: <K extends string>(event: K, ...args: unknown[]) => void
  /** 發給特定玩家 */
  emitTo: (playerId: string, event: string, ...args: unknown[]) => void
  onGameEnd: (summary: GameOverSummary) => void
}

interface PendingStrike { x: number; y: number; at: number; radius: number; damage: number; kind: string }

export class Game {
  host: GameHost
  mode: Mode
  difficulty: number
  players = new Map<string, SPlayer>()
  playerCount: number
  rng: () => number
  seed: number

  phase: 'combat' | 'intermission' | 'gameover' = 'combat'
  wave = 0
  zone = ZONES[0]
  time = 0
  duration = 60
  totalTime = 0
  totalKills = 0

  enemies: SEnemy[] = []
  projectiles: SProjectile[] = []
  enemyProjs: SEnemyProj[] = []
  zones: SZone[] = []
  mines: SMine[] = []
  bombs: SBomb[] = []          // 睏寶的放置炸彈
  bombSeq = 1
  turrets: STurret[] = []
  drops: SDrop[] = []
  objectives: SObjective[] = []
  boss: SBoss | null = null
  bossDefeated = false
  pendingStrikes: PendingStrike[] = []
  fog: { until: number; dps: number; safeRadius: number; safe: { x: number; y: number }[] } | null = null

  mission: MissionRt | null = null
  event: EventRt | null = null
  eventMods: NonNullable<EventData['mods']> = {}
  wave1EliteSpawned = false
  routeMods: RouteMods = defaultRouteMods()
  nextRouteMods: RouteMods = defaultRouteMods()
  lastDangerEvent = false
  forceEliteSpawns = 0

  team: TeamState = {
    revives: 0, revivesBought: 0, reviveShards: 0, bossDamage: 0, objectiveHp: 0, waveShield: 0,
  }
  nextWaveDropBoost = 1
  nextShopDiscount = 0
  nextRareBoost = 0

  director: DirectorState = newDirector()
  spawner = { budgetLeft: 0, budgetTotal: 0, timer: 1 }
  caps = capsOf(1)

  /** ×2 金幣 charge：上一波沒吃到的金幣數（掉金幣時消耗，spawnDrop 處理；跨波保留） */
  goldX2Charges = 0

  // 中場
  interStep: 'settlement' = 'settlement'
  settlement: WaveSettlement | null = null
  routeOffers: { routeId: string; votes: Set<string> }[] = []
  teamRewardOffer: { options: { id: string; name: string; description: string }[]; picks: Map<string, string[]> } | null = null
  victoryPending = false

  private evQueue: GameEv[] = []
  private snapTimer = 0
  private debugTimer = 0
  private interval: ReturnType<typeof setInterval> | null = null
  private lastTickAt = 0
  tickMs = 0

  constructor(host: GameHost, config: RoomConfig, roster: { id: string; name: string; token: string; socketId: string; charId: string; weaponId: string }[]) {
    this.host = host
    this.mode = config.mode
    this.difficulty = config.difficulty
    this.playerCount = clamp(roster.length, 1, 4)
    this.caps = capsOf(this.playerCount)
    this.seed = config.mode === 'daily' ? dailySeed() : hashSeed(`${Date.now()}-${Math.random()}`)
    this.rng = mulberry32(this.seed)
    this.team.revives = REVIVES_PER_MODE[this.mode]

    const spread = 120
    let idx = 0
    for (const r of roster) {
      const char = CHARACTER_MAP.get(r.charId) ?? [...CHARACTER_MAP.values()][0]
      const weaponData = WEAPON_MAP.get(r.weaponId) ?? WEAPON_MAP.get(char.startWeapons[0])!
      const p: SPlayer = {
        id: r.id, name: r.name, token: r.token, socketId: r.socketId,
        connected: true, disconnectAt: 0,
        char, weapons: [newOwnedWeapon(weaponData)],
        upgrades: new Map(), effects: new Map(),
        boonMods: {}, boonDmgMult: 1, boonSkillPower: 0, boonSkillCd: 0, boonWaveShield: 0,
        x: ARENA.w / 2 + (idx - roster.length / 2) * spread, y: ARENA.h * 0.6,
        lastX: 0, lastY: 0,
        status: 'alive', hp: 1, shield: 0, gold: 8, xp: 0, level: 1, pendingLevelups: 0,
        stats: null as never,
        skillCdLeft: 0, skillCharges: 1, skillMaxCharges: 1,
        buffs: { hasteUntil: 0, hasteAmt: 0, rageUntil: 0, rageAmt: 0, critUntil: 0, critAmt: 0, surgeUntil: 0, surgeAmt: 0, invulnUntil: 0, shieldNextWave: 0 },
        dashUntil: 0, dashVx: 0, dashVy: 0,
        bulwarkUntil: 0, bulwarkVx: 0, bulwarkVy: 0,
        chi: 0, chiDecayAt: 0,
        drowsy: 0, wakeLockUntil: 0, alarmUntil: 0, deathSyncAt: 0, freeBombs: 0,
        kbVx: 0, kbVy: 0, kbUntil: 0,
        downedCount: 0, reviveProgress: 0, bleedOutAt: 0, lastHitAt: -99, fogTick: 0,
        usedPhoenix: false, usedFirstDownRevive: false, eliteTrophyStacks: 0, pulseTimer: 10, regenTick: 0,
        reviveShards: 0, soloRevives: roster.length === 1 ? REVIVES_PER_MODE[this.mode] : 0,
        chestKeyBonus: 0,
        wave: emptyStat(), total: emptyStat(), god: false,
        shopOffers: [], refreshCount: 0, levelupChoices: [], chests: [], pendingItems: [],
        interReady: false, fx: '', fxUntil: 0,
      }
      recomputeEffects(p)
      p.hp = p.stats.maxHp
      p.lastX = p.x; p.lastY = p.y
      this.players.set(p.id, p)
      idx++
    }

    this.host.emit('game:begin', {
      mode: this.mode,
      arena: { w: ARENA.w, h: ARENA.h },
      zone: this.zone.id,
      players: roster.map(r => ({
        id: r.id, name: r.name, charId: r.charId,
        weapons: [{ id: this.players.get(r.id)!.weapons[0].data.id, level: 1 }],
      })),
    })
    this.startWave(1)
    this.interval = setInterval(() => this.tick(), 1000 / TICK_HZ)
    this.lastTickAt = Date.now()
  }

  destroy(): void {
    if (this.interval) clearInterval(this.interval)
    this.interval = null
  }

  ev(e: GameEv): void { this.evQueue.push(e) }
  broadcastToast(msg: string, kind: 'info' | 'warn' | 'good' = 'info'): void {
    this.host.emit('toast', { msg, kind })
  }
  toastTo(p: SPlayer, msg: string, kind: 'info' | 'warn' | 'good' = 'info'): void {
    this.host.emitTo(p.id, 'toast', { msg, kind })
  }
  dropGold(x: number, y: number, amount: number): void {
    let left = amount
    while (left > 0) {
      const v = Math.min(left, 4)
      spawnDrop(this, 'coin', x + (this.rng() - 0.5) * 50, y + (this.rng() - 0.5) * 50, v)
      left -= v
    }
  }
  healEv(p: SPlayer, amount: number): void { healPlayer(this, p, amount) }
  damageEnemy(e: SEnemy, dmg: number, opts?: Parameters<typeof damageEnemyImpl>[3]): void {
    damageEnemyImpl(this, e, dmg, opts)
  }
  shopDiscountFor(_p: SPlayer): number {
    return Math.min(0.6, this.nextShopDiscount + (this.eventMods.shopDiscount ?? 0))
  }

  // ================================================================ 波次流程

  startWave(wave: number): void {
    this.wave = wave
    this.phase = 'combat'
    this.time = 0
    this.duration = spawnWindow(wave)   // 放怪窗口（節奏用）；波次結束改看「怪清光」不看時間
    this.bossDefeated = false
    this.enemies = []
    this.projectiles = []
    this.enemyProjs = []
    this.zones = []
    this.mines = []
    this.bombs = []
    this.turrets = []
    this.drops = []
    this.objectives = []
    this.pendingStrikes = []
    this.fog = null
    this.boss = null
    this.routeMods = this.nextRouteMods
    this.nextRouteMods = defaultRouteMods()

    // 區域輪替（每 4 波換一區）
    this.zone = ZONE_MAP.get(ZONE_ORDER[Math.floor((wave - 1) / 2) % ZONE_ORDER.length])!

    // 事件（平衡規則：高危不連續、Boss 前一波不出）
    this.event = null
    this.eventMods = {}
    const bossNextWave = isBossWave(this.mode, wave + 1)
    const bossThisWave = isBossWave(this.mode, wave)
    if (!bossThisWave && wave >= EVENT_RULES.minWave && this.rng() < EVENT_RULES.chancePerWave) {
      let pool = EVENTS.filter(e => wave >= e.minWave)
      if (this.lastDangerEvent) pool = pool.filter(e => e.danger === 0)
      if (EVENT_RULES.noDangerBeforeBoss && bossNextWave) pool = pool.filter(e => e.danger === 0)
      if (pool.length) {
        const ev = weightedR(this.rng, pool)
        this.event = { data: ev, tick: 0 }
        this.eventMods = { ...ev.mods }
        this.lastDangerEvent = ev.danger === 1
      }
    } else {
      this.lastDangerEvent = false
    }

    // 任務（Boss 波固定生存）
    const missionData = bossThisWave ? null : rollMission(this)
    this.mission = missionData
      ? { data: missionData, target: missionData.baseTarget, progress: 0, done: false, failed: false, guardTimer: 0 }
      : null
    if (this.mission) setupMission(this)

    // 生成預算
    const budget = Math.round(spawnBudget(wave, this.playerCount) * this.routeMods.enemyCountMult * (bossThisWave ? 0.35 : 1))
    this.spawner = { budgetLeft: budget, budgetTotal: budget, timer: 1.2 }

    // 玩家重置
    for (const p of this.players.values()) {
      p.wave = emptyStat()
      p.interReady = false
      p.refreshCount = 0
      // this.time 每波歸零 → 清掉上一波遺留的絕對時間計時器，否則會被當成「仍在生效」
      // （例如殘留的盾牌衝鋒/衝刺會讓角色自己往施放方向走，直到重新施放技能才好）
      p.dashUntil = 0; p.dashVx = 0; p.dashVy = 0
      p.bulwarkUntil = 0; p.bulwarkVx = 0; p.bulwarkVy = 0
      p.buffs.hasteUntil = 0; p.buffs.rageUntil = 0; p.buffs.critUntil = 0; p.buffs.invulnUntil = 0; p.buffs.surgeUntil = 0
      p.kbUntil = 0; p.wakeLockUntil = 0; p.alarmUntil = 0; p.deathSyncAt = 0
      p.fx = ''; p.fxUntil = 0
      p.lastHitAt = -99
      if (p.status === 'downed') { p.status = 'alive'; p.hp = Math.round(p.stats.maxHp * 0.4) }
      if (p.status === 'alive') {
        // 每波開場護盾：團隊獎勵 + 寶箱 boon（甲殼共生/聖盾祝福） + 晨間武裝升級
        p.shield += this.team.waveShield + p.boonWaveShield + 20 * eff(p, 'waveShieldUp')
        // 上一波買的道具開場生效
        for (const it of p.pendingItems) applyItem(this, p, it)
        p.pendingItems = []
      }
      // 重生位置（保持目前位置，第一波例外）
      if (wave === 1) { p.x = ARENA.w / 2; p.y = ARENA.h * 0.6 }
      clampArena(p, 30)
      if (p.status === 'alive') bombsOnWaveStart(this, p)   // 睏寶：重置睡意 + 彈藥箱（紫）開場鋪彈
    }
    this.routeMods.dropMult = this.nextWaveDropBoost
    this.nextWaveDropBoost = 1
    this.nextShopDiscount = 0
    this.nextRareBoost = 0

    // 地圖物件 + 隨機陷阱
    spawnProps(this)
    spawnTraps(this)
    setupEventObjects(this)

    // 路線覆寫：毒霧地形
    if (this.routeMods.poisonEdges && !this.event) {
      this.event = { data: EVENTS.find(e => e.id === 'poison_edge')!, tick: 0 }
    }

    // Boss
    const bossTier = bossThisWave
    let bossInfo: { id: string; name: string; title: string } | undefined
    if (bossTier) {
      const list = BOSS_ROTATION[bossTier]
      const rot = bossTier === 'mini' ? Math.floor(wave / 5) : Math.floor(wave / 10)
      const id = list[rot % list.length]
      spawnBoss(this, id)
      if (this.boss) {
        const b = this.boss as SBoss
        bossInfo = { id: b.data.id, name: b.data.name, title: b.data.title }
      }
      // Boss 波打死為止（checkWaveEnd 看 bossDefeated）；duration 僅供小怪放怪節奏用
    }

    // 菁英巢穴路線：本關必出菁英
    if (this.routeMods.eliteForce) this.forceEliteSpawns++

    // 第一波劇本：最後 10 秒出 1 隻小菁英（in tick）
    this.host.emit('wave:start', {
      wave, zone: this.zone.id,
      event: this.event?.data.id,
      mission: this.mission ? { name: this.mission.data.name, desc: missionDesc(this) } : undefined,
      duration: this.duration,
      boss: bossInfo,
    })
    this.broadcastLoadouts()
  }

  /** 廣播每個玩家的武器清單（client 用來畫貼身武器：環繞刀刃/無人機） */
  broadcastLoadouts(): void {
    this.host.emit('game:loadouts', [...this.players.values()].map(p => ({
      id: p.id,
      weapons: p.weapons.map(w => ({ id: w.data.id, level: w.level })),
    })))
  }

  private endWave(): void {
    this.phase = 'intermission'
    // 自動吸取剩餘掉落物
    vacuumAll(this)
    // 復活倒地玩家準備中場
    const rewards = grantMissionRewards(this)

    const perPlayer: WaveSettlement['perPlayer'] = {}
    let downs = 0
    let dmgTaken = 0
    let maxHpSum = 0
    for (const p of this.players.values()) {
      perPlayer[p.id] = {
        kills: p.wave.kills, gold: p.wave.gold, xp: Math.round(p.wave.xp),
        dmgTaken: Math.round(p.wave.dmgTaken), rescues: p.wave.rescues, downs: p.wave.downs,
        dmg: Math.round(p.total.dmgDealt),
      }
      downs += p.wave.downs
      dmgTaken += p.wave.dmgTaken
      maxHpSum += p.stats.maxHp
      this.totalKills += p.wave.kills
    }
    // 評分不再「無倒地就一定 S」——把受創程度也算進去（挨越多打分越低）。
    // hitRatio = 本波受到的傷害 / 全隊最大生命，>=某比例就扣等第。
    const missionOk = this.mission?.done ?? true
    const hitRatio = dmgTaken / Math.max(1, maxHpSum)
    let score = 100
    score -= downs * 35
    score -= Math.min(60, hitRatio * 55)          // 毫髮無傷 → 幾乎不扣；被打爆 → 大扣
    if (!missionOk) score -= 25
    const grade: WaveSettlement['teamGrade'] =
      score >= 88 ? 'S' : score >= 68 ? 'A' : score >= 45 ? 'B' : 'C'
    this.settlement = {
      wave: this.wave, missionDone: this.mission?.done ?? true,
      perPlayer, teamGrade: grade, rewards,
    }

    // 任務未完成 = 輸（有任務就必須達成，不能進下一波）
    if (this.mission && !this.mission.done) {
      this.broadcastToast('❌ 任務未完成，農場淪陷！', 'warn')
      this.gameOver(false)
      return
    }

    // 勝利判定
    const finalWave = MODE_WAVES[this.mode]
    if (this.wave >= finalWave && this.mode !== 'endless') {
      this.gameOver(true)
      return
    }

    // 升級選項 / 商店 / 路線
    for (const p of this.players.values()) {
      p.interReady = false
      if (p.pendingLevelups > 0 && !p.levelupChoices.length) rollLevelupChoices(this, p)
      generateShopOffers(this, p)
    }
    // 路線改隨機（不投票）— 先決定好下一關路線，中場只顯示結果
    this.routeOffers = []

    // 團隊獎勵已移除（改由每角色專屬武器＋商店提供成長）
    this.teamRewardOffer = null

    this.host.emit('wave:end', this.settlement)
    this.pushInterState()
  }

  private startNextWave(): void {
    // 下一關路線隨機（不投票）
    {
      const route = ROUTES[Math.floor(this.rng() * ROUTES.length)]
      if (route) {
        this.nextRouteMods = { ...defaultRouteMods(), ...route.mods, rareChance: route.mods.rareChance ?? 0 } as RouteMods
        this.nextRouteMods.goldMult = route.mods.goldMult ?? 1
        this.nextRouteMods.enemyCountMult = route.mods.enemyCountMult ?? 1
        this.nextRouteMods.rewardMult = route.mods.rewardMult ?? 1
        this.nextRouteMods.chestMult = route.mods.chestMult ?? 0
        this.nextRouteMods.rangedBias = route.mods.rangedBias ?? 0
        this.broadcastToast(`前往：${route.name}（${route.reward}）`, 'info')
      }
    }
    // 團隊獎勵已於選取當下即時套用（免費多選），這裡只收掉 offer
    this.teamRewardOffer = null
    this.startWave(this.wave + 1)
  }

  private gameOver(victory: boolean): void {
    this.phase = 'gameover'
    this.victoryPending = victory && (this.mode === 'standard' || this.mode === 'quick')
    const perPlayer: WaveSettlement['perPlayer'] = {}
    for (const p of this.players.values()) {
      perPlayer[p.id] = {
        kills: p.total.kills, gold: p.total.gold, xp: Math.round(p.total.xp),
        dmgTaken: Math.round(p.total.dmgTaken), rescues: p.total.rescues, downs: p.total.downs,
        dmg: Math.round(p.total.dmgDealt),
      }
    }
    const summary: GameOverSummary = {
      victory, wave: this.wave, mode: this.mode,
      totalKills: [...this.players.values()].reduce((s, p) => s + p.total.kills, 0),
      duration: Math.round(this.totalTime),
      perPlayer,
    }
    this.host.emit('game:over', summary)
    this.host.onGameEnd(summary)
  }

  /** 標準/快速通關後房主續戰無盡 */
  continueEndless(): void {
    if (this.phase !== 'gameover' || !this.victoryPending) return
    this.victoryPending = false
    this.mode = 'endless'
    for (const p of this.players.values()) {
      if (p.status === 'dead') { p.status = 'alive'; p.hp = Math.round(p.stats.maxHp * 0.5) }
    }
    this.broadcastToast('🌊 無盡模式開始！每 5 波小 Boss、每 10 波大 Boss', 'warn')
    this.startWave(this.wave + 1)
  }

  /** 單人暫停（多人不允許，避免卡住其他玩家） */
  paused = false
  onPause(playerId: string, paused: boolean): void {
    if (this.playerCount !== 1) return
    if (!this.players.has(playerId)) return
    this.paused = paused
    this.lastTickAt = Date.now()   // 避免恢復時 dt 暴衝
    this.host.emit('game:paused', paused)
  }

  // ================================================================ 主迴圈

  private tick(): void {
    const now = Date.now()
    if (this.paused) { this.lastTickAt = now; return }
    const dt = Math.min((now - this.lastTickAt) / 1000, 0.1)
    this.lastTickAt = now
    const t0 = performance.now()
    this.totalTime += dt

    if (this.phase === 'combat') {
      this.time += dt
      this.playersTick(dt)
      directorTick(this, dt)
      spawnerTick(this, dt)
      this.scriptedSpawns()
      enemiesTick(this, dt)
      bossTick(this, dt)
      weaponsTick(this, dt)
      enemyProjsTick(this, dt)
      dropsTick(this, dt)
      missionTick(this, dt)
      trapsTick(this, dt)
      eventTick(this, dt)
      strikesTick(this)
      this.fogTick(dt)
      // 任務失敗（目標被摧毀等）= 直接輸，不能進下一波
      if (this.mission?.failed && this.phase === 'combat') {
        this.broadcastToast('❌ 任務失敗，農場淪陷！', 'warn')
        this.gameOver(false)
      }
      this.checkWaveEnd()
      this.checkWipe()
    }

    // 快照 + 事件批次
    this.snapTimer -= dt
    if (this.snapTimer <= 0) {
      this.snapTimer = 1 / SNAP_HZ
      if (this.evQueue.length) {
        this.host.emit('game:ev', this.evQueue)
        this.evQueue = []
      }
      if (this.phase === 'combat') this.host.emit('game:snap', this.buildSnapshot())
    }
    this.debugTimer -= dt
    if (this.debugTimer <= 0) {
      this.debugTimer = 1
      this.host.emit('debug:state', this.buildDebug())
    }
    this.tickMs = performance.now() - t0
  }

  /** 第一波劇本：最後 10 秒出小菁英；elite 任務保底 */
  private scriptedSpawns(): void {
    // 第一波：放完約六成怪後補一隻小菁英當教學
    if (this.wave === 1 && this.spawner.budgetLeft <= this.spawner.budgetTotal * 0.4 && !this.wave1EliteSpawned) {
      this.wave1EliteSpawned = true
      const pos = edgeSpawnPos(this)
      spawnEnemy(this, 'slug', pos.x, pos.y, { elite: true })
      this.broadcastToast('⚠️ 菁英怪出現了！', 'warn')
    }
    if (this.forceEliteSpawns > 0 && this.time > 2) {
      this.forceEliteSpawns--
      const pos = edgeSpawnPos(this)
      const pool = this.zone.enemyPool.filter(e => this.wave >= (e.fromWave ?? 1))
      const id = pool.length ? weightedR(this.rng, pool).id : 'slug'
      spawnEnemy(this, id, pos.x, pos.y, { elite: true })
    }
  }

  /** 靠近就打壞地圖物件（木箱/木桶/補血草…）— 走過去就會自動撞破，不用等武器剛好瞄到 */
  private breakNearbyProps(p: SPlayer, dt: number): void {
    for (const o of this.objectives) {
      if (o.t !== 'prop' || o.s === 2 || o.hp <= 0) continue
      if (dist2(p.x, p.y, o.x, o.y) < (o.r + 40) ** 2) {
        this.damageObjective(o, 30 * dt)          // 約 0.5 秒撞破一個
      }
    }
  }

  private playersTick(dt: number): void {
    const now = this.time
    for (const p of this.players.values()) {
      if (!p.connected) continue
      if (p.status === 'dead') continue

      if (p.status === 'downed') {
        this.reviveTick(p, dt)
        continue
      }

      this.breakNearbyProps(p, dt)

      // 移動（client 位置 + server 限速）
      const haste = p.buffs.hasteUntil > now ? p.buffs.hasteAmt : 0
      let far = 0
      if (eff(p, 'farAllySpeed') && this.playerCount > 1) {
        let nearest = Infinity
        for (const q of this.players.values()) if (q !== p && q.connected && q.status !== 'dead') nearest = Math.min(nearest, dist2(p.x, p.y, q.x, q.y))
        if (nearest > 400 * 400) far = 0.15
      }
      const maxSpd = p.stats.moveSpeed * (1 + haste + far)
      let moved = true
      if (p.kbUntil > now) {
        // 被自己的爆風炸飛（睏寶）：強制位移，期間不吃輸入。
        // 刻意不覆寫 lastX/lastY——那是玩家的拖曳目標，炸飛結束後要能接著走。
        p.x += p.kbVx * dt
        p.y += p.kbVy * dt
        p.kbVx *= 0.9; p.kbVy *= 0.9
        // 被炸飛不算「移動」——睡著的人被自己的炸彈拋來拋去，還是在睡
        moved = false
      } else if (p.dashUntil > now) {
        p.x += p.dashVx * dt
        p.y += p.dashVy * dt
        // 衝撞傷害
        for (const e of this.enemies) {
          if (e.hp <= 0 || dist2(e.x, e.y, p.x, p.y) > (e.radius + 30) ** 2) continue
          const prm = p.char.active.params ?? {}
          const [kx, ky] = norm(e.x - p.x, e.y - p.y)
          damageEnemyImpl(this, e, (prm.damage ?? 25) * p.stats.damage * this.skillPowerOf(p), { ownerId: p.id, knockX: kx * (prm.knockback ?? 200), knockY: ky * (prm.knockback ?? 200), srcX: p.x, srcY: p.y })
        }
      } else if (p.bulwarkUntil > now) {
        // 盾牌衝鋒：緩速往前推進，撞飛沿路怪物（減傷在 damagePlayer 處理）
        p.x += p.bulwarkVx * dt
        p.y += p.bulwarkVy * dt
        const prm = p.char.active.params ?? {}
        for (const e of this.enemies) {
          if (e.hp <= 0 || dist2(e.x, e.y, p.x, p.y) > (e.radius + 42) ** 2) continue
          const [kx, ky] = norm(e.x - p.x, e.y - p.y)
          damageEnemyImpl(this, e, (prm.damage ?? 20) * p.stats.damage * dt * 3, { ownerId: p.id, knockX: kx * (prm.knockback ?? 300), knockY: ky * (prm.knockback ?? 300), srcX: p.x, srcY: p.y })
        }
      } else {
        const dx = p.lastX - p.x, dy = p.lastY - p.y
        const dd = Math.hypot(dx, dy)
        const step = maxSpd * dt * 1.2
        if (dd > 0.5) {
          const k = Math.min(1, step / dd)
          p.x += dx * k
          p.y += dy * k
        } else moved = false
      }
      clampArena(p, 26)

      // 睏寶「夢囈引信」：靜止累積睡意、移動流失、受擊歸零（放彈/火力由 bombs.buildSpec 讀）
      drowsyTick(this, p, dt, moved)

      // 拳王辣椒「連段」：停手 idleGrace 秒後開始衰減
      if (p.char.passive.effect === 'comboMeter' && this.time > p.chiDecayAt && p.chi > 0) {
        p.chi = Math.max(0, p.chi - COMBO.decayPerSec * dt)
      }
      // 幽靈菇「虛體漂移」：期間內周身怨氣持續灼傷並吸取貼身敵人的生命（跟著幽靈移動）
      if (p.fx === 'phase' && p.fxUntil > now) {
        const prm = p.char.active.params ?? {}
        const r = (prm.radius ?? 130) * p.stats.area
        for (const e of this.enemies) {
          if (e.hp <= 0 || dist2(e.x, e.y, p.x, p.y) > r * r) continue
          const dealt = damageEnemyImpl(this, e, (prm.dps ?? 16) * p.stats.damage * dt, { ownerId: p.id, srcX: p.x, srcY: p.y })
          if (dealt > 0) healPlayer(this, p, dealt * (prm.leech ?? 0.4))
        }
      }

      // 回血 / 光環 / 詛咒流失
      p.regenTick -= dt
      if (p.regenTick <= 0) {
        p.regenTick = 1
        let regen = p.stats.regen
        if (eff(p, 'nearAllyRegen')) {
          for (const q of this.players.values()) {
            if (q !== p && q.status === 'alive' && dist2(p.x, p.y, q.x, q.y) < 160 * 160) { regen += eff(p, 'nearAllyRegen'); break }
          }
        }
        if (eff(p, 'curseFrenzy')) regen -= 0.8
        if (regen > 0) healPlayer(this, p, regen)
        else if (regen < 0) { p.hp = Math.max(1, p.hp + regen) }
        // 醫生光環
        for (const q of this.players.values()) {
          if (q.char.passive.effect === 'auraHealFastRescue' && q !== p && q.status === 'alive'
            && dist2(p.x, p.y, q.x, q.y) < 160 * 160 && p.status === 'alive') {
            healPlayer(this, p, 1.2)
          }
        }
      }

      // 大地脈衝
      if (eff(p, 'pulse10s')) {
        p.pulseTimer -= dt
        if (p.pulseTimer <= 0) {
          p.pulseTimer = 10
          this.ev({ t: 'aoe', x: Math.round(p.x), y: Math.round(p.y), r: 2000, kind: 'pulse' })
          for (const e of this.enemies) {
            const [kx, ky] = norm(e.x - p.x, e.y - p.y)
            damageEnemyImpl(this, e, 10 * p.stats.damage, { ownerId: p.id, knockX: kx * 150, knockY: ky * 150 })
          }
        }
      }

      p.skillCdLeft = Math.max(0, p.skillCdLeft - dt * (1 + p.stats.cooldown))
      if (p.skillCdLeft <= 0 && p.skillCharges < p.skillMaxCharges) {
        p.skillCharges++
        if (p.skillCharges < p.skillMaxCharges) p.skillCdLeft = p.char.active.cooldown
      }
      if (p.fxUntil < now) p.fx = ''
    }
  }

  /** 倒地救援：靠近的隊友自動施救（多人加速、受擊中斷 1 秒） */
  private reviveTick(p: SPlayer, dt: number): void {
    const now = this.time
    // 爬行：往 lastX/lastY 緩慢移動
    const dx = p.lastX - p.x, dy = p.lastY - p.y
    const dd = Math.hypot(dx, dy)
    if (dd > 2) {
      const step = DOWNED.crawlSpeed * dt
      p.x += dx / dd * Math.min(step, dd)
      p.y += dy / dd * Math.min(step, dd)
    }
    // 流血倒數
    if (now > p.bleedOutAt) { this.killPlayer(p); return }

    // 站進救援圈的存活隊友即施救（不再因受擊中斷 → 踩著約 5 秒就救起）
    const rescuers = [...this.players.values()].filter(q =>
      q !== p && q.connected && q.status === 'alive'
      && dist2(q.x, q.y, p.x, p.y) < DOWNED.reviveRadius ** 2)
    if (rescuers.length) {
      const baseTime = Math.min(DOWNED.maxReviveTime, DOWNED.baseReviveTime + (p.downedCount - 1) * DOWNED.reviveTimePerDown)
      const speedMult = rescuers.reduce((s, q) => s + q.stats.reviveSpeed, 0)
        * Math.pow(1 / DOWNED.multiRescuerBonus, rescuers.length - 1)
      p.reviveProgress += (dt / baseTime) * speedMult
      if (p.reviveProgress >= 1) {
        this.revivePlayer(p, rescuers[0])
      }
    } else {
      p.reviveProgress = Math.max(0, p.reviveProgress - dt * 0.25)
    }
  }

  private revivePlayer(p: SPlayer, by: SPlayer | null): void {
    p.status = 'alive'
    p.hp = Math.round(p.stats.maxHp * DOWNED.revivedHpPct)
    p.reviveProgress = 0
    this.ev({ t: 'revive', id: p.id, by: by?.id })
    if (by) {
      by.wave.rescues++; by.total.rescues++
      // 救援升級效果
      if (by.char.passive.effect === 'meleeBoostRescueShield') by.shield += 30
      if (eff(by, 'rescueShield')) by.shield += 25 * eff(by, 'rescueShield')
      if (eff(by, 'rescueHealBoth')) {
        healPlayer(this, by, by.stats.maxHp * 0.2)
        healPlayer(this, p, p.stats.maxHp * 0.2)
      }
      if (eff(by, 'rescueKnockback')) {
        this.ev({ t: 'aoe', x: Math.round(p.x), y: Math.round(p.y), r: 180, kind: 'pulse' })
        for (const e of this.enemies) {
          if (dist2(e.x, e.y, p.x, p.y) < 180 * 180) {
            const [kx, ky] = norm(e.x - p.x, e.y - p.y)
            e.kbVx += kx * 300; e.kbVy += ky * 300
          }
        }
      }
      // 護盾網路
      if (eff(by, 'shieldShare') && by.shield > 0) {
        for (const q of this.players.values()) {
          if (q !== by && q.status === 'alive' && dist2(q.x, q.y, by.x, by.y) < 200 * 200) q.shield += Math.round(by.shield * 0.3)
        }
      }
    }
  }

  private killPlayer(p: SPlayer): void {
    p.status = 'dead'
    this.ev({ t: 'dead', id: p.id })
    this.broadcastToast(`💀 ${p.name} 倒下了…`, 'warn')
    this.checkWipe()
  }

  damagePlayer(p: SPlayer, dmg: number, _opts: { noKnockdownBelow?: number } = {}): void {
    if (p.god || p.status !== 'alive') return
    const now = this.time
    if (p.buffs.invulnUntil > now || p.dashUntil > now) return
    // 迴避：命中前擲骰，成功＝完全免傷（上限 70%）
    if (p.stats.dodge > 0 && this.rng() < p.stats.dodge) {
      this.ev({ t: 'pmiss', id: p.id })
      return
    }
    // 護甲：每點 -6%，上限 60%
    let armor = p.stats.armor
    if (eff(p, 'nearAllyArmor')) {
      for (const q of this.players.values()) {
        if (q !== p && q.status === 'alive' && dist2(p.x, p.y, q.x, q.y) < 160 * 160) { armor += eff(p, 'nearAllyArmor'); break }
      }
    }
    let d = dmg * (1 - Math.min(0.6, armor * 0.06))
    if (p.stats.damageReduction > 0) d *= 1 - p.stats.damageReduction   // 傷害減免（護甲之外第二層，已於 stats 封頂 50%）
    d *= 1 - drowsyDr(p)                                                 // 睏寶熟睡（厚棉被）
    if (p.bulwarkUntil > now) d *= 1 - (p.char.active.params?.dr ?? 0.9)   // 盾牌衝鋒減傷
    d = Math.max(1, Math.round(d))
    // 睏寶：任何打到身上的傷害都會把他吵醒——即使被護盾吃光（護盾擋的是血，不是睡眠）
    wakeUp(this, p)
    if (p.shield > 0) {
      const ab = Math.min(p.shield, d)
      p.shield -= ab
      d -= ab
    }
    if (d <= 0) return
    p.hp -= d
    p.wave.dmgTaken += d
    p.total.dmgTaken += d
    p.lastHitAt = now
    this.ev({ t: 'phit', id: p.id, d })
    if (p.hp <= 0) {
      if (bombsDeathSave(this, p)) return  // 遙控器（紫）保命同步
      this.downPlayer(p)
    }
  }

  private downPlayer(p: SPlayer): void {
    p.hp = 0
    // 自動復活效果
    if (eff(p, 'phoenix') && !p.usedPhoenix) {
      p.usedPhoenix = true
      p.hp = Math.round(p.stats.maxHp * 0.5)
      p.buffs.invulnUntil = this.time + 2
      this.broadcastToast(`🔥 ${p.name} 的不死菜心發動！`, 'good')
      return
    }
    if (eff(p, 'firstDownAutoRevive') && !p.usedFirstDownRevive) {
      p.usedFirstDownRevive = true
      p.hp = Math.round(p.stats.maxHp * 0.4)
      p.buffs.invulnUntil = this.time + 2
      this.broadcastToast(`💫 ${p.name} 的不倒蔬魂發動！`, 'good')
      return
    }
    p.downedCount++
    p.wave.downs++; p.total.downs++
    this.director.recentDowns.push(this.time)

    // 單人：自動復活次數
    if (this.playerCount === 1) {
      if (p.soloRevives > 0) {
        p.soloRevives--
        p.hp = Math.round(p.stats.maxHp * 0.5)
        p.buffs.invulnUntil = this.time + 2.5
        this.ev({ t: 'aoe', x: Math.round(p.x), y: Math.round(p.y), r: TEAM_REVIVE.clearRadius, kind: 'pulse' })
        for (const e of this.enemies) {
          if (dist2(e.x, e.y, p.x, p.y) < TEAM_REVIVE.clearRadius ** 2 && e.data.tier === 1) e.hp = 0
        }
        this.broadcastToast(`自動復活！剩餘 ${p.soloRevives} 次`, 'warn')
        return
      }
      this.killPlayer(p)
      return
    }

    p.status = 'downed'
    p.reviveProgress = 0
    const extra = eff(p, 'downTimeUp') * 15
    p.bleedOutAt = this.time + DOWNED.bleedOutTime + extra
    this.ev({ t: 'down', id: p.id })
    this.broadcastToast(`🆘 ${p.name} 倒地了，快去救援！`, 'warn')
  }

  damageObjective(o: SObjective, dmg: number): void {
    if (o.s === 2 || o.hp <= 0) return
    o.hp -= dmg
    if (o.hp <= 0) {
      o.hp = 0
      o.s = 2
      if (o.t === 'prop') {
        onPropDestroyed(this, o)
        removeObjective(this, o)
      } else if (o.t === 'nest') {
        if (this.mission?.data.type === 'nests') this.mission.progress++
        this.dropGold(o.x, o.y, 6)
      } else if (o.t === 'pillar') {
        if (this.fog) this.fog.safe.push({ x: o.x, y: o.y })
        this.ev({ t: 'toast', msg: '毒菇柱倒下，清出安全區！', kind: 'good' })
      }
      // crystal / base / cart 歸零 → missionTick 判定失敗
    }
  }

  private fogTick(dt: number): void {
    const f = this.fog
    if (!f) return
    if (this.time > f.until) { this.fog = null; return }
    for (const p of this.players.values()) {
      if (p.status !== 'alive') continue
      const safe = f.safe.some(s => dist2(p.x, p.y, s.x, s.y) < f.safeRadius ** 2)
      if (!safe) {
        p.fogTick -= dt
        if (p.fogTick <= 0) {
          p.fogTick = 0.5
          this.damagePlayer(p, f.dps * 0.5)
        }
      }
    }
  }

  private checkWaveEnd(): void {
    if (this.phase !== 'combat') return   // 任務失敗已切到 gameover → 別再結算成中場
    const bossWave = isBossWave(this.mode, this.wave)
    if (bossWave) {
      if (this.bossDefeated) this.endWave()
      return
    }
    // 殺光制：本波怪物全數生成（budget 耗盡）且場上清空 → 進下一波
    if (this.spawner.budgetLeft <= 0 && this.enemies.length === 0) this.endWave()
  }

  /** 給 HUD：本波仍在放怪（budget 未耗盡） */
  get spawningPhase(): boolean {
    return this.phase === 'combat' && this.spawner.budgetLeft > 0 && !isBossWave(this.mode, this.wave)
  }

  private checkWipe(): void {
    const ps = [...this.players.values()].filter(p => p.connected)
    if (!ps.length) return
    const anyAlive = ps.some(p => p.status === 'alive')
    if (anyAlive) return
    const anyDowned = ps.some(p => p.status === 'downed')
    if (anyDowned && this.team.revives > 0) {
      // 團隊復活
      this.team.revives--
      this.ev({ t: 'teamRevive' })
      for (const p of ps) {
        if (p.status === 'downed' || p.status === 'dead') {
          p.status = 'alive'
          p.hp = Math.round(p.stats.maxHp * TEAM_REVIVE.healPct)
          p.buffs.invulnUntil = this.time + 2.5
        } else if (p.status === 'alive') {
          healPlayer(this, p, p.stats.maxHp * TEAM_REVIVE.healPct)
        }
      }
      const cx = ps.reduce((s, p) => s + p.x, 0) / ps.length
      const cy = ps.reduce((s, p) => s + p.y, 0) / ps.length
      this.ev({ t: 'aoe', x: Math.round(cx), y: Math.round(cy), r: TEAM_REVIVE.clearRadius, kind: 'pulse' })
      for (const e of this.enemies) {
        if (dist2(e.x, e.y, cx, cy) < TEAM_REVIVE.clearRadius ** 2) e.hp = Math.min(e.hp, e.data.tier === 1 ? 0 : e.hp * 0.5)
      }
      this.broadcastToast(`⛑️ 團隊復活！剩餘 ${this.team.revives} 次`, 'good')
      return
    }
    if (this.phase === 'combat') this.gameOver(false)
  }

  // ================================================================ 玩家輸入

  onMove(playerId: string, x: number, y: number): void {
    const p = this.players.get(playerId)
    if (!p || p.status === 'dead') return
    p.lastX = clamp(x, 26, ARENA.w - 26)
    p.lastY = clamp(y, 26, ARENA.h - 26)
  }

  /** 技能傷害倍率：奧義精通升級 + 寶箱「奧義精髓」boon，各 +35%/層 — 技能後期化的引擎 */
  skillPowerOf(p: SPlayer): number {
    return 1 + 0.35 * (eff(p, 'skillPower') + p.boonSkillPower)
  }
  /** 技能範圍倍率：開局 0.72（收斂、不誇張），每級技能強化 +0.16 → 升級後才變誇張。
   *  「享受成長感」：早期範圍小，靠奧義精通/奧義精髓一路長大。 */
  skillRadiusScale(p: SPlayer): number {
    return 0.72 + 0.16 * (eff(p, 'skillPower') + p.boonSkillPower)
  }

  onSkill(playerId: string, aim?: { x?: number; y?: number; charge?: number }): void {
    const p = this.players.get(playerId)
    if (!p || p.status !== 'alive' || this.phase !== 'combat') return
    // 睏寶：技能＝在腳下放炸彈，沒有冷卻。儲存次數由「場上炸彈數」決定（bombs.ts 每 tick 更新）
    if (isKunbao(p)) { this.ev({ t: 'skill', id: p.id, s: p.char.active.id, x: p.x, y: p.y }); kunbaoSkill(this, p); return }
    if (p.skillCharges <= 0) return
    p.skillCharges--
    const charge = Math.max(0, Math.min(1, aim?.charge ?? 1))
    if (p.skillCdLeft <= 0) {
      let cd = p.char.active.cooldown
      if (eff(p, 'charTank') && p.char.active.id === 'charge') cd *= 1 - 0.25 * eff(p, 'charTank')
      cd *= Math.max(0.4, 1 - 0.1 * p.boonSkillCd)   // 寶箱「靜心冥想」：技能冷卻 -10%/層
      p.skillCdLeft = cd
    }
    const sp = this.skillPowerOf(p)
    const prm = p.char.active.params ?? {}
    this.ev({ t: 'skill', id: p.id, s: p.char.active.id, x: aim?.x, y: aim?.y })
    switch (p.char.active.id) {
      case 'charge': {
        const [nx, ny] = norm((aim?.x ?? p.lastX) - p.x, (aim?.y ?? p.lastY) - p.y)
        const dur = 0.3
        p.dashUntil = this.time + dur
        p.dashVx = nx * (prm.dist ?? 300) / dur
        p.dashVy = ny * (prm.dist ?? 300) / dur
        p.fx = 'dash'; p.fxUntil = this.time + dur
        if (eff(p, 'charTank')) p.shield += 15 * eff(p, 'charTank')
        // 居合斬揮刀特效（斬向突進終點）
        this.ev({ t: 'aoe', x: Math.round(p.x + nx * (prm.dist ?? 300) * 0.6), y: Math.round(p.y + ny * (prm.dist ?? 300) * 0.6), r: 90, kind: 'slash' })
        break
      }
      case 'bulwark': {
        const [nx, ny] = norm((aim?.x ?? p.lastX) - p.x, (aim?.y ?? p.lastY) - p.y)
        const dur = prm.duration ?? 2
        p.bulwarkUntil = this.time + dur
        p.bulwarkVx = nx * (prm.speed ?? 135)
        p.bulwarkVy = ny * (prm.speed ?? 135)
        p.shield += prm.shield ?? 40
        p.fx = 'shield'; p.fxUntil = this.time + dur
        break
      }
      case 'thornsNova': {
        const radius = (prm.radius ?? 190) * p.stats.area * this.skillRadiusScale(p)
        p.shield += prm.shield ?? 55
        this.ev({ t: 'aoe', x: Math.round(p.x), y: Math.round(p.y), r: Math.round(radius), kind: 'thorns' })
        for (const e of this.enemies) {
          if (e.hp <= 0 || dist2(e.x, e.y, p.x, p.y) > radius * radius) continue
          const [kx, ky] = norm(e.x - p.x, e.y - p.y)
          damageEnemyImpl(this, e, (prm.damage ?? 34) * p.stats.damage * sp, { ownerId: p.id, knockX: kx * (prm.knockback ?? 260), knockY: ky * (prm.knockback ?? 260), srcX: p.x, srcY: p.y })
        }
        break
      }
      case 'rapidfire': {
        let dur = prm.duration ?? 5
        if (eff(p, 'charGun')) dur += 2 * eff(p, 'charGun')
        p.buffs.rageUntil = this.time + dur
        p.buffs.rageAmt = prm.atkBoost ?? 0.8
        p.fx = 'rage'; p.fxUntil = p.buffs.rageUntil
        break
      }
      case 'healzone': {
        let radius = (prm.radius ?? 130) * p.stats.area * this.skillRadiusScale(p)
        if (eff(p, 'charMed')) radius *= 1 + 0.4 * eff(p, 'charMed')
        this.zones.push({
          x: p.x, y: p.y, radius, dps: 0, hps: (prm.hps ?? 6) * sp,
          until: this.time + (prm.duration ?? 6), ownerId: p.id, kind: 'heal', hostile: true, tick: 0,
        })
        break
      }
      case 'turret': {
        const count = eff(p, 'charEng') ? 2 : 1
        for (let k = 0; k < count; k++) {
          this.turrets.push({
            x: p.x + (this.rng() - 0.5) * 100, y: p.y + (this.rng() - 0.5) * 100,
            damage: (prm.damage ?? 6) * p.stats.damage * sp * (1 + p.stats.minionDamage), range: prm.range ?? 320,
            fireCd: prm.fireCd ?? 0.5, cdLeft: 0,
            until: this.time + (prm.duration ?? 10), ownerId: p.id,
            guard: eff(p, 'turretGuard') > 0,
          })
        }
        this.ev({ t: 'aoe', x: Math.round(p.x), y: Math.round(p.y), r: 60, kind: 'deploy' })
        break
      }
      case 'frostnova': {
        let radius = (prm.radius ?? 200) * p.stats.area * this.skillRadiusScale(p)
        let freeze = prm.freeze ?? 2.5
        if (eff(p, 'charMage')) { radius *= 1 + 0.3 * eff(p, 'charMage'); freeze += eff(p, 'charMage') }
        this.ev({ t: 'aoe', x: Math.round(p.x), y: Math.round(p.y), r: Math.round(radius), kind: 'frost' })
        for (const e of this.enemies) {
          if (dist2(e.x, e.y, p.x, p.y) > radius * radius) continue
          if (e.elite) { e.slowUntil = this.time + freeze; e.slowPct = Math.max(e.slowPct, 0.5) }  // 菁英不被定身
          else e.frozenUntil = this.time + freeze
          damageEnemyImpl(this, e, (prm.damage ?? 18) * p.stats.damage * sp, { ownerId: p.id, srcX: p.x, srcY: p.y })
        }
        break
      }
      case 'fateflip': {
        // 命運輪盤（重做）：沒有衰牌，四種全是強效果；效果隨 build（damage/sp）成長，
        // 賭運高漲（charGam）提高「頭獎」骰子風暴的機率。
        const jackpotChance = 0.25 + 0.1 * eff(p, 'charGam')
        const roll = this.rng()
        if (roll < jackpotChance) {
          // 🎰 骰子風暴：全場敵人各承受一顆隨機骰子（20~66 點 × 傷害 × 技能強化）
          this.ev({ t: 'aoe', x: Math.round(p.x), y: Math.round(p.y), r: 400, kind: 'lightning' })
          for (const e of this.enemies) {
            if (e.hp <= 0) continue
            const dice = 20 + this.rng() * 46
            damageEnemyImpl(this, e, dice * p.stats.damage * sp, { ownerId: p.id, crit: this.rng() < 0.3, srcX: p.x, srcY: p.y })
          }
          if (this.boss) damageBoss(this, 40 * p.stats.damage * sp, p.id, p.x, p.y)
          this.toastTo(p, '🎰 頭獎！骰子風暴轟炸全場！', 'good')
        } else if (roll < jackpotChance + 0.25) {
          // 🔥 黃金狂熱：攻速 +60%、金幣掉落翻倍感（直接給錢）
          p.buffs.rageUntil = this.time + 6
          p.buffs.rageAmt = 0.6
          gainGold(this, p, 6 + this.wave, false)
          this.toastTo(p, `🎲 黃金狂熱：攻速 +60%（6 秒）、金幣 +${6 + this.wave}`, 'good')
        } else if (roll < jackpotChance + 0.5) {
          // 🍀 幸運爆發：暴擊率 +40%、移速 +15%（8 秒）
          p.buffs.critUntil = this.time + 8
          p.buffs.critAmt = 0.4
          p.buffs.hasteUntil = this.time + 8
          p.buffs.hasteAmt = 0.15
          this.toastTo(p, '🎲 幸運爆發：暴擊率 +40%、移速 +15%（8 秒）', 'good')
        } else {
          // 🛡️ 蔬菜庇護：護盾 30% 最大生命 + 回復 25% 生命
          p.shield += Math.round(p.stats.maxHp * 0.3)
          healPlayer(this, p, p.stats.maxHp * 0.25)
          this.toastTo(p, '🎲 蔬菜庇護：大護盾 + 回復 25% 生命', 'good')
        }
        break
      }
      case 'whirlslash': {
        // 武士：旋風斬 — 旋身斬擊四周敵人並擊退（純爆發傷害）
        const radius = (prm.radius ?? 190) * p.stats.area * this.skillRadiusScale(p)
        this.ev({ t: 'aoe', x: Math.round(p.x), y: Math.round(p.y), r: Math.round(radius), kind: 'slash' })
        for (const e of this.enemies) {
          if (e.hp <= 0 || dist2(e.x, e.y, p.x, p.y) > radius * radius) continue
          const [kx, ky] = norm(e.x - p.x, e.y - p.y)
          damageEnemyImpl(this, e, (prm.damage ?? 45) * p.stats.damage * sp, { ownerId: p.id, crit: this.rng() < p.stats.critChance, knockX: kx * (prm.knockback ?? 200), knockY: ky * (prm.knockback ?? 200), srcX: p.x, srcY: p.y })
        }
        break
      }
      case 'spikecharge': {
        // 榴槤：蓄刺爆發 — 蓄力越久（charge 0~1）範圍越大、傷害最高 1.5 倍，往四周噴刺並留尖刺區持續傷害
        const rMin = prm.radius ?? 300, rMax = prm.maxRadius ?? 1700
        const radius = (rMin + (rMax - rMin) * charge) * p.stats.area * this.skillRadiusScale(p)
        const dmg = (prm.damage ?? 30) * (1 + 0.5 * charge) * p.stats.damage * sp
        this.ev({ t: 'aoe', x: Math.round(p.x), y: Math.round(p.y), r: Math.round(radius), kind: 'spikes' })
        for (const e of this.enemies) {
          if (e.hp <= 0 || dist2(e.x, e.y, p.x, p.y) > radius * radius) continue
          const [kx, ky] = norm(e.x - p.x, e.y - p.y)
          damageEnemyImpl(this, e, dmg, { ownerId: p.id, crit: this.rng() < p.stats.critChance, knockX: kx * (prm.knockback ?? 200), knockY: ky * (prm.knockback ?? 200), srcX: p.x, srcY: p.y })
        }
        // 尖刺區持續傷害
        this.zones.push({
          x: p.x, y: p.y, radius: Math.min(radius, 300), dps: (prm.zoneDps ?? 8) * p.stats.damage * sp, hps: 0,
          until: this.time + (prm.zoneDur ?? 1.5), ownerId: p.id, kind: 'spike', hostile: true, tick: 0,
        })
        break
      }
      case 'palmquake': {
        // 武僧：震地掌 — 拍地震盪，重擊、擊退並暈眩周圍敵人（菁英不被暈）
        const radius = (prm.radius ?? 180) * p.stats.area * this.skillRadiusScale(p)
        this.ev({ t: 'aoe', x: Math.round(p.x), y: Math.round(p.y), r: Math.round(radius), kind: 'pulse' })
        for (const e of this.enemies) {
          if (e.hp <= 0 || dist2(e.x, e.y, p.x, p.y) > radius * radius) continue
          const [kx, ky] = norm(e.x - p.x, e.y - p.y)
          damageEnemyImpl(this, e, (prm.damage ?? 26) * p.stats.damage * sp, { ownerId: p.id, knockX: kx * (prm.knockback ?? 240), knockY: ky * (prm.knockback ?? 240), srcX: p.x, srcY: p.y })
          if (!e.elite) e.stunUntil = this.time + (prm.stun ?? 1.5)
        }
        break
      }
      case 'hallucinate': {
        // 迷幻大麻：迷幻孢子 — 灑出幻覺雲，範圍內敵人陷入混亂（亂走、不攻擊）並受傷，
        // 並留下持續數秒的孢子雲，讓踏入的怪物持續混亂。菁英混亂時間減半。
        const radius = (prm.radius ?? 190) * p.stats.area * this.skillRadiusScale(p)
        const confuse = prm.confuse ?? 4
        this.ev({ t: 'aoe', x: Math.round(p.x), y: Math.round(p.y), r: Math.round(radius), kind: 'haze' })
        for (const e of this.enemies) {
          if (e.hp <= 0 || dist2(e.x, e.y, p.x, p.y) > radius * radius) continue
          e.confusedUntil = Math.max(e.confusedUntil, this.time + confuse * (e.elite ? 0.5 : 1))
          damageEnemyImpl(this, e, (prm.damage ?? 14) * p.stats.damage * sp, { ownerId: p.id, srcX: p.x, srcY: p.y })
        }
        // 留存的孢子雲（非傷害，持續施加混亂；見 combat.zonesTick 的 haze 分支）
        this.zones.push({
          x: p.x, y: p.y, radius: (prm.cloudRadius ?? 150) * p.stats.area * this.skillRadiusScale(p), dps: 0, hps: 0,
          until: this.time + (prm.cloudDur ?? 5), ownerId: p.id, kind: 'haze', hostile: false, tick: 0,
        })
        break
      }
      case 'chiBurst': {
        // 修羅武僧：氣爆拳 — 灌注全部真氣轟出一擊，對最近的敵人(及近旁)造成 base + 氣×perChi 的巨傷。
        // 氣越多越痛；施放後真氣歸零。這是他的「攢氣→一發入魂」爆發時刻。
        const power = ((prm.base ?? 40) + p.chi * (prm.perChi ?? 2.2)) * p.stats.damage * sp
        p.chi = 0
        const radius = (prm.radius ?? 90) * p.stats.area * this.skillRadiusScale(p)
        let tx = aim?.x ?? p.lastX, ty = aim?.y ?? p.lastY
        let nearest: SEnemy | null = null, best = Infinity
        for (const e of this.enemies) {
          if (e.hp <= 0) continue
          const d = dist2(e.x, e.y, tx, ty)
          if (d < best) { best = d; nearest = e }
        }
        if (nearest) { tx = nearest.x; ty = nearest.y }
        this.ev({ t: 'aoe', x: Math.round(tx), y: Math.round(ty), r: Math.round(radius), kind: 'pulse' })
        for (const e of this.enemies) {
          if (e.hp <= 0) continue
          const center = e === nearest
          if (!center && dist2(e.x, e.y, tx, ty) > radius * radius) continue
          const [kx, ky] = norm(e.x - tx, e.y - ty)
          damageEnemyImpl(this, e, power * (center ? 1 : 0.5), { ownerId: p.id, crit: this.rng() < p.stats.critChance, knockX: kx * (prm.knockback ?? 200), knockY: ky * (prm.knockback ?? 200), srcX: tx, srcY: ty })
        }
        if (this.boss && dist2(this.boss.x, this.boss.y, tx, ty) < radius * radius) damageBoss(this, power, p.id, tx, ty)
        break
      }
      case 'surge': {
        // 金剛毛豆：超覺醒 — 金光爆發變身，短時間全能力狂飆、震開四周並回血
        const dur = prm.duration ?? 7
        p.buffs.surgeUntil = this.time + dur
        p.buffs.surgeAmt = prm.dmg ?? 0.6
        p.buffs.rageUntil = this.time + dur
        p.buffs.rageAmt = prm.atk ?? 0.4
        p.buffs.hasteUntil = this.time + dur
        p.buffs.hasteAmt = prm.move ?? 0.2
        healPlayer(this, p, p.stats.maxHp * (prm.heal ?? 0.15))
        p.fx = 'surge'; p.fxUntil = this.time + dur
        const radius = (prm.radius ?? 190) * p.stats.area * this.skillRadiusScale(p)
        this.ev({ t: 'aoe', x: Math.round(p.x), y: Math.round(p.y), r: Math.round(radius), kind: 'surge' })
        for (const e of this.enemies) {
          if (e.hp <= 0 || dist2(e.x, e.y, p.x, p.y) > radius * radius) continue
          const [kx, ky] = norm(e.x - p.x, e.y - p.y)
          damageEnemyImpl(this, e, 22 * p.stats.damage * sp, { ownerId: p.id, knockX: kx * (prm.knockback ?? 260), knockY: ky * (prm.knockback ?? 260), srcX: p.x, srcY: p.y })
        }
        break
      }
      case 'megaKick': {
        // 鐵腿高麗菜：大力金剛腿 — 沿瞄準方向犁出一條火路（膠囊判定），末端大爆炸
        const [nx, ny] = norm((aim?.x ?? p.lastX) - p.x, (aim?.y ?? p.lastY) - p.y)
        const range = (prm.range ?? 640) * (0.7 + 0.3 * p.stats.area)
        const width = (prm.width ?? 92) * p.stats.area
        const endX = clamp(p.x + nx * range, 26, ARENA.w - 26), endY = clamp(p.y + ny * range, 26, ARENA.h - 26)
        const dmg = (prm.damage ?? 40) * p.stats.damage * sp
        // 火路上的火焰拖尾（沿線多個閃光，末端爆炸）
        for (let k = 1; k <= 6; k++) {
          this.ev({ t: 'aoe', x: Math.round(p.x + nx * range * (k / 6)), y: Math.round(p.y + ny * range * (k / 6)), r: 26, kind: 'flash' })
        }
        const hitLine = (ex: number, ey: number, er: number): boolean => {
          const proj = Math.max(0, Math.min(range, (ex - p.x) * nx + (ey - p.y) * ny))
          const cx = p.x + nx * proj, cy = p.y + ny * proj
          return dist2(ex, ey, cx, cy) <= (width + er) ** 2
        }
        for (const e of this.enemies) {
          if (e.hp <= 0 || !hitLine(e.x, e.y, e.radius)) continue
          damageEnemyImpl(this, e, dmg, { ownerId: p.id, crit: this.rng() < p.stats.critChance, knockX: nx * (prm.knockback ?? 340), knockY: ny * (prm.knockback ?? 340), srcX: p.x, srcY: p.y })
        }
        const radius = (prm.radius ?? 150) * p.stats.area * this.skillRadiusScale(p)
        this.ev({ t: 'aoe', x: Math.round(endX), y: Math.round(endY), r: Math.round(radius), kind: 'explosion' })
        for (const e of this.enemies) {
          if (e.hp <= 0 || dist2(e.x, e.y, endX, endY) > radius * radius) continue
          const [kx, ky] = norm(e.x - endX, e.y - endY)
          damageEnemyImpl(this, e, dmg, { ownerId: p.id, knockX: kx * 220, knockY: ky * 220, srcX: endX, srcY: endY })
        }
        if (this.boss) {
          if (hitLine(this.boss.x, this.boss.y, this.boss.data.radius) || dist2(this.boss.x, this.boss.y, endX, endY) < radius * radius) {
            damageBoss(this, dmg, p.id, p.x, p.y)
          }
        }
        break
      }
      case 'risingFist': {
        // 拳王辣椒：焰昇拳 — 連段滿檔時橫掃全場的超必殺，否則猛竄一記挑飛上鉤拳
        if (p.chi >= COMBO.max) {
          p.chi = 0
          const radius = (prm.superRadius ?? 520) * p.stats.area * this.skillRadiusScale(p)
          this.ev({ t: 'aoe', x: Math.round(p.x), y: Math.round(p.y), r: Math.round(radius), kind: 'pulse' })
          for (const e of this.enemies) {
            if (e.hp <= 0 || dist2(e.x, e.y, p.x, p.y) > radius * radius) continue
            const [kx, ky] = norm(e.x - p.x, e.y - p.y)
            damageEnemyImpl(this, e, (prm.superDmg ?? 90) * p.stats.damage * sp, { ownerId: p.id, crit: this.rng() < p.stats.critChance, knockX: kx * 320, knockY: ky * 320 - 200, srcX: p.x, srcY: p.y })
          }
          if (this.boss && dist2(this.boss.x, this.boss.y, p.x, p.y) < radius * radius) damageBoss(this, (prm.superDmg ?? 90) * p.stats.damage * sp, p.id, p.x, p.y)
          this.toastTo(p, '🔥 連段爆發：焰昇拳超必殺！', 'good')
        } else {
          const [nx, ny] = norm((aim?.x ?? p.lastX) - p.x, (aim?.y ?? p.lastY) - p.y)
          const dur = 0.25
          p.dashUntil = this.time + dur
          p.dashVx = nx * (prm.dist ?? 300) / dur
          p.dashVy = ny * (prm.dist ?? 300) / dur
          p.fx = 'dash'; p.fxUntil = this.time + dur
          const radius = (prm.radius ?? 120) * p.stats.area * this.skillRadiusScale(p)
          this.ev({ t: 'aoe', x: Math.round(p.x + nx * 70), y: Math.round(p.y + ny * 70), r: Math.round(radius), kind: 'slash' })
          for (const e of this.enemies) {
            if (e.hp <= 0 || dist2(e.x, e.y, p.x, p.y) > radius * radius) continue
            const [kx, ky] = norm(e.x - p.x, e.y - p.y)
            damageEnemyImpl(this, e, (prm.damage ?? 34) * p.stats.damage * sp, { ownerId: p.id, crit: this.rng() < p.stats.critChance, knockX: kx * (prm.knockback ?? 340), knockY: ky * (prm.knockback ?? 340) - 220, srcX: p.x, srcY: p.y })
          }
        }
        break
      }
      case 'phaseShift': {
        // 幽靈菇：虛體漂移 — 無敵 + 加速穿行；周身怨氣的持續灼傷/吸血在 tick 處理
        const dur = prm.duration ?? 3
        p.buffs.invulnUntil = this.time + dur
        p.buffs.hasteUntil = this.time + dur
        p.buffs.hasteAmt = prm.move ?? 0.4
        p.fx = 'phase'; p.fxUntil = this.time + dur
        const radius = (prm.radius ?? 130) * p.stats.area * this.skillRadiusScale(p)
        this.ev({ t: 'aoe', x: Math.round(p.x), y: Math.round(p.y), r: Math.round(radius), kind: 'haze' })
        break
      }
      case 'blink': {
        // 疾雷蔥：雷閃步 — 瞬移到瞄準點，沿途落雷連鎖電擊
        const [nx, ny] = norm((aim?.x ?? p.lastX) - p.x, (aim?.y ?? p.lastY) - p.y)
        const d = prm.dist ?? 340
        const sx = p.x, sy = p.y
        p.x = clamp(p.x + nx * d, 26, ARENA.w - 26)
        p.y = clamp(p.y + ny * d, 26, ARENA.h - 26)
        p.lastX = p.x; p.lastY = p.y
        p.fx = 'dash'; p.fxUntil = this.time + 0.2
        const dmg = (prm.damage ?? 30) * p.stats.damage * sp
        const zr = (prm.radius ?? 90)
        const zapped = new Set<number>()
        const steps = 5
        for (let k = 0; k <= steps; k++) {
          const px = sx + (p.x - sx) * (k / steps), py = sy + (p.y - sy) * (k / steps)
          this.ev({ t: 'aoe', x: Math.round(px), y: Math.round(py), r: 60, kind: 'lightning' })
          for (const e of this.enemies) {
            if (e.hp <= 0 || zapped.has(e.i) || dist2(e.x, e.y, px, py) > zr * zr) continue
            zapped.add(e.i)
            damageEnemyImpl(this, e, dmg, { ownerId: p.id, crit: this.rng() < p.stats.critChance, srcX: px, srcY: py })
          }
        }
        this.ev({ t: 'aoe', x: Math.round(p.x), y: Math.round(p.y), r: Math.round(zr * p.stats.area * this.skillRadiusScale(p)), kind: 'lightning' })
        if (this.boss && dist2(this.boss.x, this.boss.y, p.x, p.y) < 210 * 210) damageBoss(this, dmg, p.id, p.x, p.y)
        break
      }
      case 'bloodNova': {
        // 血蝠茄：血祭爆發 — 猩紅血浪重擊四周，依命中數大量吸血
        const radius = (prm.radius ?? 200) * p.stats.area * this.skillRadiusScale(p)
        this.ev({ t: 'aoe', x: Math.round(p.x), y: Math.round(p.y), r: Math.round(radius), kind: 'explosion' })
        const leech = prm.leech ?? 0.6
        for (const e of this.enemies) {
          if (e.hp <= 0 || dist2(e.x, e.y, p.x, p.y) > radius * radius) continue
          const [kx, ky] = norm(e.x - p.x, e.y - p.y)
          const dealt = damageEnemyImpl(this, e, (prm.damage ?? 34) * p.stats.damage * sp, { ownerId: p.id, crit: this.rng() < p.stats.critChance, knockX: kx * (prm.knockback ?? 200), knockY: ky * (prm.knockback ?? 200), srcX: p.x, srcY: p.y })
          if (dealt > 0) healPlayer(this, p, dealt * leech)
        }
        if (this.boss && dist2(this.boss.x, this.boss.y, p.x, p.y) < radius * radius) {
          const d = (prm.damage ?? 34) * p.stats.damage * sp
          damageBoss(this, d, p.id, p.x, p.y); healPlayer(this, p, d * leech)
        }
        break
      }
      case 'singularity': {
        // 念力酪梨：奇點 — 在瞄準點造念力奇點，把周圍敵人強力吸向中心並壓縮傷害
        const cx = aim?.x ?? p.lastX, cy = aim?.y ?? p.lastY
        const radius = (prm.radius ?? 260) * p.stats.area * this.skillRadiusScale(p)
        this.ev({ t: 'aoe', x: Math.round(cx), y: Math.round(cy), r: Math.round(radius), kind: 'haze' })
        for (const e of this.enemies) {
          if (e.hp <= 0 || dist2(e.x, e.y, cx, cy) > radius * radius) continue
          const [kx, ky] = norm(cx - e.x, cy - e.y)   // 朝中心吸
          const resist = e.data.tier === 3 ? 0.4 : e.data.tier === 2 ? 0.7 : 1
          e.kbVx += kx * (prm.pull ?? 520) * resist
          e.kbVy += ky * (prm.pull ?? 520) * resist
          damageEnemyImpl(this, e, (prm.damage ?? 26) * p.stats.damage * sp, { ownerId: p.id, srcX: cx, srcY: cy })
        }
        if (this.boss && dist2(this.boss.x, this.boss.y, cx, cy) < radius * radius) damageBoss(this, (prm.damage ?? 26) * p.stats.damage * sp, p.id, cx, cy)
        break
      }
      case 'bladeDance': {
        // 千刃蘆筍：萬刃亂舞 — 瞬間爆發多段連環斬（合計傷害）
        const radius = (prm.radius ?? 175) * p.stats.area * this.skillRadiusScale(p)
        const total = (prm.damage ?? 16) * (prm.hits ?? 6) * p.stats.damage * sp
        this.ev({ t: 'aoe', x: Math.round(p.x), y: Math.round(p.y), r: Math.round(radius), kind: 'slash' })
        this.ev({ t: 'aoe', x: Math.round(p.x), y: Math.round(p.y), r: Math.round(radius * 0.8), kind: 'slash' })
        for (const e of this.enemies) {
          if (e.hp <= 0 || dist2(e.x, e.y, p.x, p.y) > radius * radius) continue
          const [kx, ky] = norm(e.x - p.x, e.y - p.y)
          damageEnemyImpl(this, e, total, { ownerId: p.id, crit: this.rng() < p.stats.critChance, knockX: kx * (prm.knockback ?? 140), knockY: ky * (prm.knockback ?? 140), srcX: p.x, srcY: p.y })
        }
        if (this.boss && dist2(this.boss.x, this.boss.y, p.x, p.y) < radius * radius) damageBoss(this, total, p.id, p.x, p.y)
        break
      }
      case 'deadeye': {
        // 快槍手玉米：神準連射 — 自動鎖定最近敵人，連開必中必暴的子彈
        const shots = prm.shots ?? 8
        const range = prm.range ?? 520
        const base = (prm.damage ?? 14) * p.stats.damage * p.stats.critDamage * sp
        for (let k = 0; k < shots; k++) {
          let tgt: SEnemy | null = null, best = range * range
          for (const e of this.enemies) { if (e.hp <= 0) continue; const d = dist2(e.x, e.y, p.x, p.y); if (d < best) { best = d; tgt = e } }
          if (tgt) {
            this.ev({ t: 'shoot', id: p.id, w: 'cg_revolver', x: Math.round(p.x), y: Math.round(p.y), tx: Math.round(tgt.x), ty: Math.round(tgt.y), n: 1 })
            this.ev({ t: 'aoe', x: Math.round(tgt.x), y: Math.round(tgt.y), r: 18, kind: 'flash' })
            damageEnemyImpl(this, tgt, base, { ownerId: p.id, crit: true, srcX: p.x, srcY: p.y })
          } else if (this.boss && dist2(this.boss.x, this.boss.y, p.x, p.y) < range * range) {
            this.ev({ t: 'shoot', id: p.id, w: 'cg_revolver', x: Math.round(p.x), y: Math.round(p.y), tx: Math.round(this.boss.x), ty: Math.round(this.boss.y), n: 1 })
            damageBoss(this, base, p.id, p.x, p.y)
          }
        }
        break
      }
      case 'sporeLegion': {
        // 孢子召喚菇：孢子軍團 — 一次布下多座孢子砲塔
        const count = prm.count ?? 3
        for (let k = 0; k < count; k++) {
          const a = (k / count) * Math.PI * 2
          this.turrets.push({
            x: clamp(p.x + Math.cos(a) * 90, 26, ARENA.w - 26), y: clamp(p.y + Math.sin(a) * 90, 26, ARENA.h - 26),
            damage: (prm.damage ?? 7) * p.stats.damage * sp * (1 + p.stats.minionDamage), range: prm.range ?? 320,
            fireCd: 0.5, cdLeft: 0, until: this.time + (prm.duration ?? 12), ownerId: p.id, guard: eff(p, 'turretGuard') > 0,
          })
        }
        this.ev({ t: 'aoe', x: Math.round(p.x), y: Math.round(p.y), r: 80, kind: 'deploy' })
        break
      }
      case 'timeStop': {
        // 凝時火龍果：凝時領域 — 在瞄準點展開極重減速領域並持續傷害
        const cx = aim?.x ?? p.lastX, cy = aim?.y ?? p.lastY
        const radius = (prm.radius ?? 240) * p.stats.area * this.skillRadiusScale(p)
        const dur = prm.duration ?? 4
        const slow = prm.slow ?? 0.85
        this.ev({ t: 'aoe', x: Math.round(cx), y: Math.round(cy), r: Math.round(radius), kind: 'frost' })
        for (const e of this.enemies) {
          if (e.hp <= 0 || dist2(e.x, e.y, cx, cy) > radius * radius) continue
          e.slowUntil = this.time + dur; e.slowPct = Math.max(e.slowPct, slow)
          damageEnemyImpl(this, e, (prm.damage ?? 14) * p.stats.damage * sp, { ownerId: p.id, srcX: cx, srcY: cy })
        }
        this.zones.push({ x: cx, y: cy, radius, dps: (prm.damage ?? 14) * 0.2 * p.stats.damage * sp, hps: 0, until: this.time + dur, ownerId: p.id, kind: 'frost', hostile: false, tick: 0, slowPct: slow, freeze: 0, born: this.time })
        break
      }
      case 'arrowRain': {
        // 神射手豌豆：箭雨 — 朝瞄準區域降下密集箭雨並留下插箭區
        const cx = aim?.x ?? p.lastX, cy = aim?.y ?? p.lastY
        const radius = (prm.radius ?? 220) * p.stats.area * this.skillRadiusScale(p)
        this.ev({ t: 'aoe', x: Math.round(cx), y: Math.round(cy), r: Math.round(radius), kind: 'spikes' })
        for (const e of this.enemies) {
          if (e.hp <= 0 || dist2(e.x, e.y, cx, cy) > radius * radius) continue
          damageEnemyImpl(this, e, (prm.damage ?? 30) * p.stats.damage * sp, { ownerId: p.id, crit: this.rng() < p.stats.critChance, srcX: cx, srcY: cy })
        }
        if (this.boss && dist2(this.boss.x, this.boss.y, cx, cy) < radius * radius) damageBoss(this, (prm.damage ?? 30) * p.stats.damage * sp, p.id, cx, cy)
        this.zones.push({ x: cx, y: cy, radius, dps: (prm.dps ?? 8) * p.stats.damage * sp, hps: 0, until: this.time + (prm.duration ?? 2), ownerId: p.id, kind: 'spike', hostile: false, tick: 0, born: this.time })
        break
      }
      case 'holyNova': {
        // 聖光大蒜：聖光爆裂 — 重傷四周敵人並治療範圍內所有存活隊友
        const radius = (prm.radius ?? 220) * p.stats.area * this.skillRadiusScale(p)
        this.ev({ t: 'aoe', x: Math.round(p.x), y: Math.round(p.y), r: Math.round(radius), kind: 'frost' })
        this.ev({ t: 'aoe', x: Math.round(p.x), y: Math.round(p.y), r: Math.round(radius), kind: 'heal' })
        for (const e of this.enemies) {
          if (e.hp <= 0 || dist2(e.x, e.y, p.x, p.y) > radius * radius) continue
          const [kx, ky] = norm(e.x - p.x, e.y - p.y)
          damageEnemyImpl(this, e, (prm.damage ?? 30) * p.stats.damage * sp, { ownerId: p.id, knockX: kx * (prm.knockback ?? 180), knockY: ky * (prm.knockback ?? 180), srcX: p.x, srcY: p.y })
        }
        for (const q of this.players.values()) {
          if (q.status === 'alive' && dist2(q.x, q.y, p.x, p.y) < radius * radius) healPlayer(this, q, (prm.heal ?? 25) * sp)
        }
        if (this.boss && dist2(this.boss.x, this.boss.y, p.x, p.y) < radius * radius) damageBoss(this, (prm.damage ?? 30) * p.stats.damage * sp, p.id, p.x, p.y)
        break
      }
    }
  }

  // ---- 中場操作

  onLevelupPick(playerId: string, offerId: string): void {
    const p = this.players.get(playerId)
    if (!p || this.phase !== 'intermission') return
    const choice = p.levelupChoices.find(c => c.offerId === offerId)
    if (!choice || p.pendingLevelups <= 0) return
    applyUpgrade(this, p, choice.upgradeId)
    p.pendingLevelups--
    p.levelupChoices = []
    if (p.pendingLevelups > 0) rollLevelupChoices(this, p)
    this.pushInterState()
  }

  onChestPick(playerId: string, chestId: string, rewardId: string): void {
    const p = this.players.get(playerId)
    if (!p || this.phase !== 'intermission') return
    const err = applyChestChoice(this, p, chestId, rewardId)
    if (err) this.toastTo(p, err, 'warn')
    this.pushInterState()
  }

  onShopBuy(playerId: string, offerId: string): void {
    const p = this.players.get(playerId)
    if (!p || this.phase !== 'intermission') return
    const err = buyOffer(this, p, offerId)
    if (err) this.toastTo(p, err, 'warn')
    this.pushInterState()
  }

  onShopRefresh(playerId: string): void {
    const p = this.players.get(playerId)
    if (!p || this.phase !== 'intermission') return
    const err = refreshShop(this, p)
    if (err) this.toastTo(p, err, 'warn')
    this.pushInterState()
  }

  onShopLock(playerId: string, offerId: string, locked: boolean): void {
    const p = this.players.get(playerId)
    const o = p?.shopOffers.find(o => o.offerId === offerId)
    if (o) o.locked = locked
    this.pushInterState()
  }

  onShopSell(playerId: string, weaponIndex: number): void {
    const p = this.players.get(playerId)
    if (!p || this.phase !== 'intermission') return
    const err = sellWeapon(this, p, weaponIndex)
    if (err) this.toastTo(p, err, 'warn')
    this.pushInterState()
  }

  onRouteVote(playerId: string, routeId: string): void {
    if (this.phase !== 'intermission') return
    for (const r of this.routeOffers) r.votes.delete(playerId)
    this.routeOffers.find(r => r.routeId === routeId)?.votes.add(playerId)
    this.pushInterState()
  }

  /** 團隊獎勵免費多選：每人有配額（依人數），選一個即時套用，不可重複選同一項 */
  onTeamRewardPick(playerId: string, id: string): void {
    const p = this.players.get(playerId)
    if (!p || this.phase !== 'intermission' || !this.teamRewardOffer) return
    if (!this.teamRewardOffer.options.some(o => o.id === id)) return
    const mine = this.teamRewardOffer.picks.get(playerId) ?? []
    const quota = teamRewardPicksPerPlayer(this.playerCount)
    if (mine.length >= quota || mine.includes(id)) return
    mine.push(id)
    this.teamRewardOffer.picks.set(playerId, mine)
    applyTeamReward(this, id)
    this.pushInterState()
  }

  onInterReady(playerId: string): void {
    const p = this.players.get(playerId)
    if (!p || this.phase !== 'intermission') return
    p.interReady = true
    this.pushInterState()
    const connected = [...this.players.values()].filter(q => q.connected)
    if (connected.every(q => q.interReady)) this.startNextWave()
  }

  // ---- 連線管理

  onDisconnect(playerId: string): void {
    const p = this.players.get(playerId)
    if (!p) return
    p.connected = false
    p.socketId = null
    p.disconnectAt = Date.now()
    if (p.status === 'alive' || p.status === 'downed') {
      // 保留角色，暫時無敵且不動
      p.buffs.invulnUntil = this.time + 9999
    }
    this.broadcastToast(`${p.name} 斷線了（保留位置等待重連）`, 'warn')
    if (this.phase === 'intermission') {
      this.pushInterState()
      const connected = [...this.players.values()].filter(q => q.connected)
      if (connected.length && connected.every(q => q.interReady)) this.startNextWave()
    }
  }

  onReconnect(playerId: string, socketId: string): void {
    const p = this.players.get(playerId)
    if (!p) return
    p.connected = true
    p.socketId = socketId
    p.buffs.invulnUntil = this.time + 2
    this.broadcastToast(`${p.name} 重新連線！`, 'good')
    // 補發完整狀態
    this.host.emitTo(playerId, 'game:begin', {
      mode: this.mode,
      arena: { w: ARENA.w, h: ARENA.h },
      zone: this.zone.id,
      players: [...this.players.values()].map(q => ({
        id: q.id, name: q.name, charId: q.char.id,
        weapons: q.weapons.map(w => ({ id: w.data.id, level: w.level })),
      })),
    })
    this.host.emitTo(playerId, 'wave:start', {
      wave: this.wave, zone: this.zone.id,
      event: this.event?.data.id,
      mission: this.mission ? { name: this.mission.data.name, desc: missionDesc(this) } : undefined,
      duration: this.duration,
      boss: this.boss ? { id: this.boss.data.id, name: this.boss.data.name, title: this.boss.data.title } : undefined,
    })
    // 現存實體重播（生成事件）
    const replay: GameEv[] = []
    for (const e of this.enemies) {
      replay.push({ t: 'spawn', e: { i: e.i, k: e.data.id, x: Math.round(e.x), y: Math.round(e.y), mhp: e.maxHp, e: e.elite ? 1 : undefined, a: e.affixes.length ? e.affixes.map(a => a.id) : undefined, sz: e.sizeMult !== 1 ? e.sizeMult : undefined } })
    }
    for (const d of this.drops) {
      replay.push({ t: 'drop', d: { i: d.i, t: d.t, x: Math.round(d.x), y: Math.round(d.y), v: d.v, it: d.item } })
    }
    for (const o of this.objectives) {
      replay.push({ t: 'objSpawn', o: { i: o.i, t: o.t, x: Math.round(o.x), y: Math.round(o.y), hp: o.hp, mhp: o.maxHp, pg: o.pg, r: o.r, s: o.s, k: o.k } })
    }
    if (this.boss) replay.push({ t: 'bossSpawn', id: this.boss.data.id, name: this.boss.data.name, title: this.boss.data.title, mhp: this.boss.maxHp })
    this.host.emitTo(playerId, 'game:ev', replay)
    this.broadcastLoadouts()
    if (this.phase === 'intermission') this.pushInterState()
  }

  // ---- Debug

  onDebug(playerId: string, cmd: DebugCmd): void {
    const p = this.players.get(playerId)
    if (!p) return
    switch (cmd.c) {
      case 'skipWave': if (this.phase === 'combat') { this.bossDefeated = true; this.spawner.budgetLeft = 0; this.enemies = []; if (this.boss) this.boss.hp = 0 } break
      case 'gold': p.gold += cmd.n; break
      case 'xp': gainXp(this, p, cmd.n); break
      case 'spawn': {
        for (let k = 0; k < cmd.n; k++) {
          const pos = edgeSpawnPos(this)
          spawnEnemy(this, cmd.id, pos.x, pos.y, {})
        }
        break
      }
      case 'boss': spawnBoss(this, cmd.id); break
      case 'pressure': this.director.pressure = cmd.n; break
      case 'god': p.god = !p.god; this.toastTo(p, p.god ? '無敵開啟' : '無敵關閉'); break
      case 'reset': break
    }
  }

  // ================================================================ 快照

  private buildSnapshot(): Snapshot {
    const now = this.time
    return {
      t: Math.round(now * 10) / 10,
      left: 0,                                    // 殺光制：不再有波次倒數
      spawning: this.spawningPhase ? 1 : undefined,
      players: [...this.players.values()].map(p => ({
        id: p.id, x: Math.round(p.x), y: Math.round(p.y),
        hp: Math.round(p.hp), mhp: p.stats.maxHp,
        st: p.connected ? p.status : 'disconnected',
        lv: p.level, sh: Math.round(p.shield),
        rp: Math.round(p.reviveProgress * 100) / 100,
        cd: Math.round(p.skillCdLeft * 10) / 10,
        gold: p.gold,
        xp: Math.round(p.xp), nxp: xpForLevel(p.level),
        dn: p.downedCount, pu: p.pendingLevelups,
        dmg: Math.round(p.total.dmgDealt),
        // 目前移速（含加速 buff）——client 自機預測用（升級移速才會真的變快）
        spd: Math.round(p.stats.moveSpeed * (p.buffs.hasteUntil > now ? 1 + p.buffs.hasteAmt : 1)),
        fx: p.fx || undefined,
        dz: isKunbao(p) ? Math.round(p.drowsy) : undefined,
        sc: isKunbao(p) ? p.skillCharges : undefined,
        smc: isKunbao(p) ? p.skillMaxCharges : undefined,
        chi: (p.char.active.id === 'chiBurst' || p.char.passive.effect === 'comboMeter') ? Math.round(p.chi) : undefined,
      })),
      enemies: this.enemies.map(e => ({
        i: e.i, x: Math.round(e.x), y: Math.round(e.y),
        h: Math.max(0, Math.round((e.hp / e.maxHp) * 100)),
        f: (e.shield > 0 ? 1 : 0) | (e.frozenUntil > now ? 2 : 0) | (e.slowUntil > now ? 4 : 0) | (e.fuse >= 0 ? 8 : 0) | (e.confusedUntil > now ? 16 : 0) | (e.cloaked ? 32 : 0),
        // k/e/sz：讓 client 漏收 spawn 事件時也能補建這隻怪（否則變隱形怪）
        k: ENEMY_INDEX.get(e.data.id) ?? 0,
        e: e.elite ? 1 as const : undefined,
        sz: e.sizeMult !== 1 ? Math.round(e.sizeMult * 100) / 100 : undefined,
      })),
      objectives: this.objectives.map(o => ({
        i: o.i, t: o.t, x: Math.round(o.x), y: Math.round(o.y),
        hp: Math.round(o.hp), mhp: o.maxHp, pg: Math.round(o.pg * 100) / 100, r: o.r, s: o.s, k: o.k,
      })),
      boss: this.boss ? {
        id: this.boss.data.id, x: Math.round(this.boss.x), y: Math.round(this.boss.y),
        hp: Math.round(this.boss.hp), mhp: this.boss.maxHp, ph: this.boss.phaseIdx,
        cast: this.boss.casting ? { s: this.boss.casting.skill, until: Math.round(this.boss.casting.until * 10) / 10, x: this.boss.casting.x, y: this.boss.casting.y, ang: this.boss.casting.ang } : undefined,
        sh: this.boss.shield > 0 ? Math.round(this.boss.shield) : undefined,
        stun: this.boss.stunUntil > now ? Math.round((this.boss.stunUntil - now) * 10) / 10 : undefined,
      } : undefined,
      eProj: this.enemyProjs.map(pr => ({ x: Math.round(pr.x), y: Math.round(pr.y) })),
      turrets: this.turrets.length ? this.turrets.map(t => (t.guard ? { x: Math.round(t.x), y: Math.round(t.y), g: 1 as const } : { x: Math.round(t.x), y: Math.round(t.y) })) : undefined,
      zones: this.zones.length ? this.zones.map(z => ({ x: Math.round(z.x), y: Math.round(z.y), r: Math.round(z.radius), k: z.kind, h: z.hostile ? 1 as const : undefined })) : undefined,
      mines: this.mines.length ? this.mines.map(m => (now >= m.armAt ? { x: Math.round(m.x), y: Math.round(m.y), r: Math.round(m.radius), a: 1 as const } : { x: Math.round(m.x), y: Math.round(m.y), r: Math.round(m.radius) })) : undefined,
      bombs: this.bombs.length ? this.bombs.map(b => ({
        x: Math.round(b.x), y: Math.round(b.y),
        f: Math.round(Math.max(0, b.fuse / Math.max(0.01, b.fuseMax)) * 100) / 100,
        r: Math.round(b.arm),
        x2: b.crossX ? 1 as const : undefined,
        s: b.gen > 0 ? 1 as const : undefined,
        l: b.lateral ? 1 as const : undefined,
      })) : undefined,
      director: { pressure: Math.round(this.director.pressure), level: this.director.level },
      mission: this.mission ? {
        name: this.mission.data.name,
        progress: Math.round(this.mission.progress),
        target: this.mission.target,
        done: this.mission.done,
        failed: this.mission.failed || undefined,
      } : undefined,
      event: this.event?.data.id,
      teamRevives: this.team.revives,
      counts: { enemies: this.enemies.length, elites: this.enemies.filter(e => e.elite).length, drops: this.drops.length },
    }
  }

  pushInterState(): void {
    if (this.phase !== 'intermission') return
    // 進化檢查：滿級武器 + 擁有指定升級 → 自動進化（放這裡確保買完/選完升級立刻觸發）
    let evolved = false
    for (const p of this.players.values()) if (checkEvolutions(this, p)) evolved = true
    if (evolved) this.broadcastLoadouts()
    for (const p of this.players.values()) {
      if (!p.connected || !p.socketId) continue
      const view: IntermissionView = {
        step: 'settlement',
        wave: this.wave,
        nextWave: this.wave + 1,
        settlement: this.settlement!,
        pendingLevelups: p.pendingLevelups,
        levelupChoices: p.levelupChoices.map(c => ({ offerId: c.offerId, upgradeId: c.upgradeId, rarity: rarityOf(c.upgradeId) })),
        chests: p.chests,
        shop: {
          offers: p.shopOffers,
          refreshCost: 4 + p.refreshCount * 2,
          discount: this.shopDiscountFor(p),
        },
        routes: this.routeOffers.map(r => ({ routeId: r.routeId, votes: [...r.votes] })),
        teamReward: this.teamRewardOffer ? {
          options: this.teamRewardOffer.options,
          picks: Object.fromEntries(this.teamRewardOffer.picks),
          picksPerPlayer: teamRewardPicksPerPlayer(this.playerCount),
        } : undefined,
        readySet: [...this.players.values()].filter(q => q.interReady).map(q => q.id),
        gold: p.gold,
        me: {
          weapons: p.weapons.map(w => ({ id: w.data.id, level: w.level })),
          upgrades: [...p.upgrades.entries()].flatMap(([id, n]) => Array(n).fill(id)),
          stats: p.stats,
        },
        bossNext: isBossWave(this.mode, this.wave + 1) !== null,
      }
      this.host.emitTo(p.id, 'inter:state', view)
    }
  }

  private buildDebug(): DebugState {
    const ps = [...this.players.values()].filter(p => p.connected)
    return {
      wave: this.wave,
      players: ps.length,
      avgHpPct: ps.length ? Math.round(ps.reduce((s, p) => s + p.hp / Math.max(1, p.stats.maxHp), 0) / ps.length * 100) : 0,
      teamDps: Math.round(ps.reduce((s, p) => s + p.wave.dmgDealt, 0) / Math.max(1, this.time)),
      enemies: this.enemies.length,
      elites: this.enemies.filter(e => e.elite).length,
      drops: this.drops.length,
      pressure: Math.round(this.director.pressure),
      directorLevel: this.director.level,
      spawnMult: Math.round(this.debugSpawnMult() * 100) / 100,
      healDropMult: Math.round(this.debugHealMult() * 100) / 100,
      event: this.event?.data.name ?? '—',
      missionProgress: this.mission ? `${this.mission.data.name} ${Math.round(this.mission.progress)}/${this.mission.target}` : '—',
      tickMs: Math.round(this.tickMs * 10) / 10,
    }
  }
  private debugSpawnMult(): number { return spawnMult(this) }
  private debugHealMult(): number { return healDropMult(this) }
}

function emptyStat(): WaveStat {
  return { kills: 0, gold: 0, xp: 0, dmgTaken: 0, rescues: 0, downs: 0, dmgDealt: 0 }
}

function missionDesc(g: Game): string {
  const m = g.mission!
  return m.data.descTemplate.replace('{n}', String(m.target))
}

function rarityOf(upgradeId: string): Rarity {
  return UPGRADE_MAP.get(upgradeId)?.rarity ?? 'common'
}
