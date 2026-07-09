// 一場遊戲的權威狀態機：20Hz tick、波次流程、倒地救援、團隊復活、
// 中場（結算/升級/商店/路線投票）、快照廣播、Debug 指令。
import type {
  Mode, GameEv, Snapshot, IntermissionView, WaveSettlement,
  GameOverSummary, DebugCmd, DebugState, RoomConfig,
} from '../../../shared/types'
import {
  ARENA, TICK_HZ, SNAP_HZ, PLAYER_SCALING, MODE_WAVES, spawnWindow,
  isBossWave, spawnBudget, REVIVES_PER_MODE, TEAM_REVIVE, DOWNED,
  caps as capsOf, EVENT_RULES, xpForLevel,
} from '../../../shared/balance'
import {
  CHARACTER_MAP, WEAPON_MAP, ZONES, ZONE_MAP, ZONE_ORDER, EVENTS,
  ROUTES, BOSS_ROTATION, UPGRADE_MAP,
} from '../../../shared/content/index'
import type { EventData, Rarity } from '../../../shared/types'
import { mulberry32, hashSeed, dailySeed, weightedR, shuffleR } from '../../../shared/rng'
import type {
  SPlayer, SEnemy, SProjectile, SEnemyProj, SZone, SMine, STurret,
  SDrop, SObjective, SBoss, MissionRt, EventRt, RouteMods, TeamState, WaveStat,
} from './state'
import { defaultRouteMods, newOwnedWeapon } from './state'
import { dist2, norm, clamp, clampArena } from './util'
import { recomputeEffects, eff } from './stats'
import { newDirector, directorTick, spawnMult, healDropMult, type DirectorState } from './director'
import { weaponsTick, enemyProjsTick } from './combat'
import { spawnerTick, enemiesTick, spawnEnemy, edgeSpawnPos, damageEnemyImpl } from './enemies'
import { spawnBoss, bossTick } from './boss'
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
        x: ARENA.w / 2 + (idx - roster.length / 2) * spread, y: ARENA.h * 0.6,
        lastX: 0, lastY: 0,
        status: 'alive', hp: 1, shield: 0, gold: 8, xp: 0, level: 1, pendingLevelups: 0,
        stats: null as never,
        skillCdLeft: 0, skillCharges: 1, skillMaxCharges: 1,
        buffs: { hasteUntil: 0, hasteAmt: 0, rageUntil: 0, rageAmt: 0, invulnUntil: 0, shieldNextWave: 0 },
        dashUntil: 0, dashVx: 0, dashVy: 0,
        bulwarkUntil: 0, bulwarkVx: 0, bulwarkVy: 0,
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
      p.buffs.hasteUntil = 0; p.buffs.rageUntil = 0; p.buffs.invulnUntil = 0
      p.fx = ''; p.fxUntil = 0
      p.lastHitAt = -99
      if (p.status === 'downed') { p.status = 'alive'; p.hp = Math.round(p.stats.maxHp * 0.4) }
      if (p.status === 'alive') {
        p.shield += this.team.waveShield            // 團隊獎勵：每波開場永久護盾
        // 上一波買的道具開場生效
        for (const it of p.pendingItems) applyItem(this, p, it)
        p.pendingItems = []
      }
      // 重生位置（保持目前位置，第一波例外）
      if (wave === 1) { p.x = ARENA.w / 2; p.y = ARENA.h * 0.6 }
      clampArena(p, 30)
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
    if (this.forceEliteSpawns > 0 && this.time > 8) {
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
      if (p.dashUntil > now) {
        p.x += p.dashVx * dt
        p.y += p.dashVy * dt
        // 衝撞傷害
        for (const e of this.enemies) {
          if (e.hp <= 0 || dist2(e.x, e.y, p.x, p.y) > (e.radius + 30) ** 2) continue
          const prm = p.char.active.params ?? {}
          const [kx, ky] = norm(e.x - p.x, e.y - p.y)
          damageEnemyImpl(this, e, (prm.damage ?? 25) * p.stats.damage, { ownerId: p.id, knockX: kx * (prm.knockback ?? 200), knockY: ky * (prm.knockback ?? 200), srcX: p.x, srcY: p.y })
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
        }
      }
      clampArena(p, 26)

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
    // 護甲：每點 -6%，上限 60%
    let armor = p.stats.armor
    if (eff(p, 'nearAllyArmor')) {
      for (const q of this.players.values()) {
        if (q !== p && q.status === 'alive' && dist2(p.x, p.y, q.x, q.y) < 160 * 160) { armor += eff(p, 'nearAllyArmor'); break }
      }
    }
    let d = dmg * (1 - Math.min(0.6, armor * 0.06))
    if (p.bulwarkUntil > now) d *= 1 - (p.char.active.params?.dr ?? 0.9)   // 盾牌衝鋒減傷
    d = Math.max(1, Math.round(d))
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
    if (p.hp <= 0) this.downPlayer(p)
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

  onSkill(playerId: string, aim?: { x?: number; y?: number; charge?: number }): void {
    const p = this.players.get(playerId)
    if (!p || p.status !== 'alive' || this.phase !== 'combat') return
    if (p.skillCharges <= 0) return
    p.skillCharges--
    const charge = Math.max(0, Math.min(1, aim?.charge ?? 1))
    if (p.skillCdLeft <= 0) {
      let cd = p.char.active.cooldown
      if (eff(p, 'charTank') && p.char.active.id === 'charge') cd *= 1 - 0.25 * eff(p, 'charTank')
      p.skillCdLeft = cd
    }
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
        const radius = (prm.radius ?? 190) * p.stats.area
        p.shield += prm.shield ?? 55
        this.ev({ t: 'aoe', x: Math.round(p.x), y: Math.round(p.y), r: Math.round(radius), kind: 'thorns' })
        for (const e of this.enemies) {
          if (e.hp <= 0 || dist2(e.x, e.y, p.x, p.y) > radius * radius) continue
          const [kx, ky] = norm(e.x - p.x, e.y - p.y)
          damageEnemyImpl(this, e, (prm.damage ?? 34) * p.stats.damage, { ownerId: p.id, knockX: kx * (prm.knockback ?? 260), knockY: ky * (prm.knockback ?? 260), srcX: p.x, srcY: p.y })
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
        let radius = (prm.radius ?? 130) * p.stats.area
        if (eff(p, 'charMed')) radius *= 1 + 0.4 * eff(p, 'charMed')
        this.zones.push({
          x: p.x, y: p.y, radius, dps: 0, hps: prm.hps ?? 6,
          until: this.time + (prm.duration ?? 6), ownerId: p.id, kind: 'heal', hostile: true, tick: 0,
        })
        break
      }
      case 'turret': {
        const count = eff(p, 'charEng') ? 2 : 1
        for (let k = 0; k < count; k++) {
          this.turrets.push({
            x: p.x + (this.rng() - 0.5) * 100, y: p.y + (this.rng() - 0.5) * 100,
            damage: prm.damage ?? 6, range: prm.range ?? 320,
            fireCd: prm.fireCd ?? 0.5, cdLeft: 0,
            until: this.time + (prm.duration ?? 10), ownerId: p.id,
            guard: eff(p, 'turretGuard') > 0,
          })
        }
        break
      }
      case 'frostnova': {
        let radius = (prm.radius ?? 220) * p.stats.area
        let freeze = prm.freeze ?? 2.5
        if (eff(p, 'charMage')) { radius *= 1 + 0.3 * eff(p, 'charMage'); freeze += eff(p, 'charMage') }
        this.ev({ t: 'aoe', x: Math.round(p.x), y: Math.round(p.y), r: Math.round(radius), kind: 'frost' })
        for (const e of this.enemies) {
          if (dist2(e.x, e.y, p.x, p.y) > radius * radius) continue
          if (e.elite) { e.slowUntil = this.time + freeze; e.slowPct = Math.max(e.slowPct, 0.5) }  // 菁英不被定身
          else e.frozenUntil = this.time + freeze
          damageEnemyImpl(this, e, (prm.damage ?? 18) * p.stats.damage, { ownerId: p.id, srcX: p.x, srcY: p.y })
        }
        break
      }
      case 'fateflip': {
        const badChance = eff(p, 'charGam') ? 0.15 : 0.3
        if (this.rng() < badChance) {
          const bad = Math.floor(this.rng() * 2)
          if (bad === 0) { p.hp = Math.max(1, p.hp - Math.round(p.stats.maxHp * 0.05)); this.toastTo(p, '🎲 翻到衰牌：損失 5% 生命', 'warn') }
          else { p.buffs.hasteUntil = this.time + 2; p.buffs.hasteAmt = -0.3; this.toastTo(p, '🎲 翻到衰牌：減速 2 秒', 'warn') }
        } else {
          const good = Math.floor(this.rng() * 4)
          if (good === 0) { p.buffs.rageUntil = this.time + 6; p.buffs.rageAmt = 0.6; this.toastTo(p, '🎲 命運眷顧：攻速大增！', 'good') }
          else if (good === 1) { healPlayer(this, p, p.stats.maxHp * 0.3); this.toastTo(p, '🎲 命運眷顧：回復 30% 生命', 'good') }
          else if (good === 2) { gainGold(this, p, 10, false); this.toastTo(p, '🎲 命運眷顧：金幣 +10', 'good') }
          else { p.shield += 40; this.toastTo(p, '🎲 命運眷顧：護盾 +40', 'good') }
        }
        break
      }
      case 'whirlslash': {
        // 武士：旋風斬 — 旋身斬擊四周敵人並擊退（純爆發傷害）
        const radius = (prm.radius ?? 190) * p.stats.area
        this.ev({ t: 'aoe', x: Math.round(p.x), y: Math.round(p.y), r: Math.round(radius), kind: 'slash' })
        for (const e of this.enemies) {
          if (e.hp <= 0 || dist2(e.x, e.y, p.x, p.y) > radius * radius) continue
          const [kx, ky] = norm(e.x - p.x, e.y - p.y)
          damageEnemyImpl(this, e, (prm.damage ?? 45) * p.stats.damage, { ownerId: p.id, crit: this.rng() < p.stats.critChance, knockX: kx * (prm.knockback ?? 200), knockY: ky * (prm.knockback ?? 200), srcX: p.x, srcY: p.y })
        }
        break
      }
      case 'spikecharge': {
        // 榴槤：蓄刺爆發 — 蓄力越久（charge 0~1）範圍越大、傷害最高 1.5 倍，往四周噴刺並留尖刺區持續傷害
        const rMin = prm.radius ?? 300, rMax = prm.maxRadius ?? 1700
        const radius = (rMin + (rMax - rMin) * charge) * p.stats.area
        const dmg = (prm.damage ?? 30) * (1 + 0.5 * charge) * p.stats.damage
        this.ev({ t: 'aoe', x: Math.round(p.x), y: Math.round(p.y), r: Math.round(radius), kind: 'spikes' })
        for (const e of this.enemies) {
          if (e.hp <= 0 || dist2(e.x, e.y, p.x, p.y) > radius * radius) continue
          const [kx, ky] = norm(e.x - p.x, e.y - p.y)
          damageEnemyImpl(this, e, dmg, { ownerId: p.id, crit: this.rng() < p.stats.critChance, knockX: kx * (prm.knockback ?? 200), knockY: ky * (prm.knockback ?? 200), srcX: p.x, srcY: p.y })
        }
        // 尖刺區持續傷害
        this.zones.push({
          x: p.x, y: p.y, radius: Math.min(radius, 300) , dps: (prm.zoneDps ?? 8) * p.stats.damage, hps: 0,
          until: this.time + (prm.zoneDur ?? 1.5), ownerId: p.id, kind: 'spike', hostile: true, tick: 0,
        })
        break
      }
      case 'palmquake': {
        // 武僧：震地掌 — 拍地震盪，重擊、擊退並暈眩周圍敵人（菁英不被暈）
        const radius = (prm.radius ?? 180) * p.stats.area
        this.ev({ t: 'aoe', x: Math.round(p.x), y: Math.round(p.y), r: Math.round(radius), kind: 'pulse' })
        for (const e of this.enemies) {
          if (e.hp <= 0 || dist2(e.x, e.y, p.x, p.y) > radius * radius) continue
          const [kx, ky] = norm(e.x - p.x, e.y - p.y)
          damageEnemyImpl(this, e, (prm.damage ?? 26) * p.stats.damage, { ownerId: p.id, knockX: kx * (prm.knockback ?? 240), knockY: ky * (prm.knockback ?? 240), srcX: p.x, srcY: p.y })
          if (!e.elite) e.stunUntil = this.time + (prm.stun ?? 1.5)
        }
        break
      }
      case 'hallucinate': {
        // 迷幻大麻：迷幻孢子 — 灑出幻覺雲，範圍內敵人陷入混亂（亂走、不攻擊）並受傷，
        // 並留下持續數秒的孢子雲，讓踏入的怪物持續混亂。菁英混亂時間減半。
        const radius = (prm.radius ?? 240) * p.stats.area
        const confuse = prm.confuse ?? 4
        this.ev({ t: 'aoe', x: Math.round(p.x), y: Math.round(p.y), r: Math.round(radius), kind: 'haze' })
        for (const e of this.enemies) {
          if (e.hp <= 0 || dist2(e.x, e.y, p.x, p.y) > radius * radius) continue
          e.confusedUntil = Math.max(e.confusedUntil, this.time + confuse * (e.elite ? 0.5 : 1))
          damageEnemyImpl(this, e, (prm.damage ?? 14) * p.stats.damage, { ownerId: p.id, srcX: p.x, srcY: p.y })
        }
        // 留存的孢子雲（非傷害，持續施加混亂；見 combat.zonesTick 的 haze 分支）
        this.zones.push({
          x: p.x, y: p.y, radius: (prm.cloudRadius ?? 190) * p.stats.area, dps: 0, hps: 0,
          until: this.time + (prm.cloudDur ?? 5), ownerId: p.id, kind: 'haze', hostile: false, tick: 0,
        })
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
        fx: p.fx || undefined,
      })),
      enemies: this.enemies.map(e => ({
        i: e.i, x: Math.round(e.x), y: Math.round(e.y),
        h: Math.max(0, Math.round((e.hp / e.maxHp) * 100)),
        f: (e.shield > 0 ? 1 : 0) | (e.frozenUntil > now ? 2 : 0) | (e.slowUntil > now ? 4 : 0) | (e.fuse >= 0 ? 8 : 0) | (e.confusedUntil > now ? 16 : 0),
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
