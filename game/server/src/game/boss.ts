// Boss 階段機：3 隻 Boss 的技能 handler + 依人數縮放的合作機制。
// 加 Boss = bosses.ts 加資料 + 這裡加技能 handler（多數技能可重用）。
import { BOSS_MAP, ENEMY_MAP } from '../../../shared/content/index'
import { PLAYER_SCALING, OBJECT_COUNT, DIFFICULTIES, ARENA, ENEMY_SPEED_MULT } from '../../../shared/balance'
import { weightedR } from '../../../shared/rng'
import type { SBoss, SPlayer } from './state'
import type { Game } from './game'
import { dist2, norm, clamp } from './util'
import { spawnEnemy, damageEnemyImpl } from './enemies'
import { spawnObjective, removeObjective } from './missions'
import { dropsFromKill } from './drops'
import { eff } from './stats'

export function spawnBoss(g: Game, bossId: string): void {
  const data = BOSS_MAP.get(bossId)
  if (!data) return
  const diff = DIFFICULTIES[g.difficulty] ?? DIFFICULTIES[0]
  const waveScale = 1 + Math.max(0, g.wave - 10) * 0.06
  const hp = Math.round(data.baseHp * PLAYER_SCALING[g.playerCount].boss * diff.enemyHp * waveScale)
  g.boss = {
    data, x: ARENA.w / 2, y: ARENA.h * 0.28,
    hp, maxHp: hp, phaseIdx: 0, skillTimer: 3, skillQueue: [],
    casting: null, shield: 0, stunUntil: 0,
    chargeVx: 0, chargeVy: 0, chargeUntil: 0,
    runeIdxs: [], frontAng: Math.PI / 2, touchCd: 0,
  }
  g.ev({ t: 'bossSpawn', id: data.id, name: data.name, title: data.title, mhp: hp })
  g.ev({ t: 'toast', msg: `⚠️ ${data.title} — ${data.name} 出現了！`, kind: 'warn' })
}

export function bossTick(g: Game, dt: number): void {
  const b = g.boss
  if (!b) return
  const now = g.time

  // 階段切換
  const pct = b.hp / b.maxHp
  let phase = 0
  for (let i = 0; i < b.data.phases.length; i++) {
    if (pct <= (i === 0 ? 1 : b.data.phases[i - 1].untilHpPct)) phase = i
  }
  if (phase !== b.phaseIdx) {
    b.phaseIdx = phase
    b.skillQueue = []
    g.ev({ t: 'toast', msg: `${b.data.name} 進入第 ${phase + 1} 階段！`, kind: 'warn' })
  }
  const ph = b.data.phases[b.phaseIdx]

  if (b.stunUntil > now) return
  // 衝撞進行中
  if (b.chargeUntil > now) {
    b.x += b.chargeVx * dt
    b.y += b.chargeVy * dt
    // 撞牆 → 暈眩
    if (b.x < b.data.radius || b.x > ARENA.w - b.data.radius || b.y < b.data.radius || b.y > ARENA.h - b.data.radius) {
      b.x = clamp(b.x, b.data.radius, ARENA.w - b.data.radius)
      b.y = clamp(b.y, b.data.radius, ARENA.h - b.data.radius)
      b.chargeUntil = 0
      b.stunUntil = now + (b.data.skillParams.charge?.stunTime ?? 3)
      g.ev({ t: 'bossSkill', s: 'stunned' })
      g.ev({ t: 'toast', msg: `${b.data.name} 撞牆暈眩了！全力輸出！`, kind: 'good' })
      return
    }
    // 路徑傷害
    for (const p of g.players.values()) {
      if (p.status === 'alive' && dist2(p.x, p.y, b.x, b.y) < (b.data.radius + 26) ** 2) {
        g.damagePlayer(p, b.data.damage * 1.4)
      }
    }
    return
  }

  // 施法中
  if (b.casting) {
    if (now < b.casting.until) return
    const skill = b.casting.skill
    b.casting = null
    executeSkill(g, b, skill)
    return
  }

  // 符文破盾狀態：不移動，等玩家踩符文
  if (b.shield > 0 && b.runeIdxs.length) {
    tickRunes(g, b, dt)
    return
  }

  // 一般移動：慢慢貼近最近玩家 + 接觸傷害
  const tgt = nearestAlive(g, b.x, b.y)
  if (tgt) {
    const [nx, ny] = norm(tgt.x - b.x, tgt.y - b.y)
    b.frontAng = Math.atan2(ny, nx)
    const dd = Math.sqrt(dist2(b.x, b.y, tgt.x, tgt.y))
    if (dd > b.data.radius + 20) {
      b.x += nx * b.data.speed * ENEMY_SPEED_MULT * dt
      b.y += ny * b.data.speed * ENEMY_SPEED_MULT * dt
    }
    b.touchCd -= dt
    if (dd < b.data.radius + 30 && b.touchCd <= 0) {
      b.touchCd = 1.1
      g.damagePlayer(tgt, b.data.damage)
    }
  }

  // 技能排程
  b.skillTimer -= dt
  if (b.skillTimer <= 0) {
    b.skillTimer = ph.skillInterval
    if (!b.skillQueue.length) b.skillQueue = ph.skills.slice()
    const skill = b.skillQueue.shift()!
    startSkill(g, b, skill)
  }
}

function nearestAlive(g: Game, x: number, y: number): SPlayer | null {
  let best: SPlayer | null = null
  let bd = Infinity
  for (const p of g.players.values()) {
    if (!p.connected || p.status !== 'alive') continue
    const d = dist2(x, y, p.x, p.y)
    if (d < bd) { bd = d; best = p }
  }
  return best
}

function startSkill(g: Game, b: SBoss, skill: string): void {
  const prm = b.data.skillParams[skill] ?? {}
  switch (skill) {
    case 'charge': {
      const tgt = nearestAlive(g, b.x, b.y)
      if (!tgt) return
      const [nx, ny] = norm(tgt.x - b.x, tgt.y - b.y)
      b.casting = { skill, until: g.time + (prm.telegraph ?? 1.2), ang: Math.atan2(ny, nx) }
      g.ev({ t: 'bossSkill', s: 'chargeTelegraph', x: Math.round(b.x), y: Math.round(b.y), ang: b.casting.ang })
      break
    }
    case 'fogSpread':
      b.casting = { skill, until: g.time + 1.5 }
      g.ev({ t: 'bossSkill', s: 'fogTelegraph' })
      break
    default:
      executeSkill(g, b, skill)
  }
}

function executeSkill(g: Game, b: SBoss, skill: string): void {
  const prm = b.data.skillParams[skill] ?? {}
  const players = g.playerCount
  switch (skill) {
    case 'summonMinions': case 'summonSpores': {
      const count = Math.round((prm.count ?? 3) * (0.7 + players * 0.3))
      for (let k = 0; k < count; k++) {
        const pick = b.data.summonTable ? weightedR(g.rng, b.data.summonTable) : { id: 'slug' }
        if (ENEMY_MAP.has(pick.id)) {
          spawnEnemy(g, pick.id, b.x + (g.rng() - 0.5) * 200, b.y + (g.rng() - 0.5) * 200, {})
        }
      }
      g.ev({ t: 'bossSkill', s: 'summon', x: Math.round(b.x), y: Math.round(b.y) })
      break
    }
    case 'poisonRing': {
      const rings = prm.rings ?? 3
      const tgt = nearestAlive(g, b.x, b.y)
      for (let k = 0; k < rings; k++) {
        const x = (tgt?.x ?? b.x) + (g.rng() - 0.5) * 360
        const y = (tgt?.y ?? b.y) + (g.rng() - 0.5) * 360
        g.pendingStrikes.push({ x, y, at: g.time + 1.3, radius: prm.radius ?? 90, damage: 6, kind: 'poisonStay' })
        g.ev({ t: 'aoe', x: Math.round(x), y: Math.round(y), r: prm.radius ?? 90, kind: 'telegraph' })
      }
      break
    }
    case 'shieldRunes': {
      if (b.shield > 0) break
      b.shield = Math.round(b.maxHp * (prm.shieldPct ?? 0.25))
      const n = OBJECT_COUNT[players]
      b.runeIdxs = []
      for (let k = 0; k < n; k++) {
        const ang = (k / n) * Math.PI * 2 + g.rng()
        const o = spawnObjective(g, {
          t: 'rune',
          x: b.x + Math.cos(ang) * 320, y: b.y + Math.sin(ang) * 320,
          hp: 1, maxHp: 1, pg: 0, r: prm.runeRadius ?? 60, s: 0,
        })
        b.runeIdxs.push(o.i)
      }
      g.ev({ t: 'bossSkill', s: 'shieldUp' })
      g.ev({ t: 'toast', msg: `護盾展開！${players > 1 ? '分頭' : ''}站上發光符文破盾！`, kind: 'warn' })
      break
    }
    case 'sporeBurst': {
      const n = prm.bullets ?? 10
      for (let k = 0; k < n; k++) {
        const ang = (k / n) * Math.PI * 2
        g.enemyProjs.push({
          x: b.x, y: b.y,
          vx: Math.cos(ang) * (prm.speed ?? 200), vy: Math.sin(ang) * (prm.speed ?? 200),
          damage: prm.damage ?? 10, left: 700,
        })
      }
      g.ev({ t: 'bossSkill', s: 'sporeBurst', x: Math.round(b.x), y: Math.round(b.y) })
      break
    }
    case 'fogSpread': {
      // 全場毒霧 + 毒菇柱（打掉柱子清出安全區）
      const n = OBJECT_COUNT[players] + 1
      g.fog = { until: g.time + (prm.duration ?? 10), dps: prm.fogDps ?? 6, safeRadius: prm.safeRadius ?? 150, safe: [] }
      for (let k = 0; k < n; k++) {
        const ang = (k / n) * Math.PI * 2 + g.rng()
        spawnObjective(g, {
          t: 'pillar',
          x: b.x + Math.cos(ang) * 380, y: b.y + Math.sin(ang) * 380,
          hp: prm.pillarHp ?? 60, maxHp: prm.pillarHp ?? 60, pg: 0, r: 28, s: 1,
        })
      }
      g.ev({ t: 'bossSkill', s: 'fog' })
      g.ev({ t: 'toast', msg: '毒霧擴散！打掉毒菇柱清出安全區！', kind: 'warn' })
      break
    }
    case 'charge': {
      const ang = b.casting?.ang ?? b.frontAng
      b.chargeVx = Math.cos(ang) * (prm.speed ?? 420)
      b.chargeVy = Math.sin(ang) * (prm.speed ?? 420)
      b.chargeUntil = g.time + 4
      g.ev({ t: 'bossSkill', s: 'charge', ang })
      break
    }
    case 'dropBombs': {
      const tgt = nearestAlive(g, b.x, b.y)
      for (let k = 0; k < (prm.count ?? 4); k++) {
        const x = (tgt?.x ?? b.x) + (g.rng() - 0.5) * 420
        const y = (tgt?.y ?? b.y) + (g.rng() - 0.5) * 420
        g.pendingStrikes.push({ x, y, at: g.time + (prm.fuse ?? 1.6), radius: prm.radius ?? 90, damage: prm.damage ?? 18, kind: 'explosion' })
        g.ev({ t: 'aoe', x: Math.round(x), y: Math.round(y), r: prm.radius ?? 90, kind: 'telegraph' })
      }
      break
    }
  }
}

/** 符文踩點進度（多人要同時站滿全部符文） */
function tickRunes(g: Game, b: SBoss, dt: number): void {
  const prm = b.data.skillParams.shieldRunes ?? {}
  const runes = g.objectives.filter(o => o.t === 'rune')
  if (!runes.length) { b.shield = 0; return }
  let allCharged = true
  for (const o of runes) {
    const occupied = [...g.players.values()].some(p => p.status === 'alive' && dist2(p.x, p.y, o.x, o.y) < o.r * o.r)
    if (occupied) o.pg = Math.min(1, o.pg + dt / (prm.channelTime ?? 3))
    else o.pg = Math.max(0, o.pg - dt * 0.35)
    o.s = o.pg >= 1 ? 2 : occupied ? 1 : 0
    if (o.pg < 1) allCharged = false
  }
  if (allCharged) {
    b.shield = 0
    b.runeIdxs = []
    for (const o of runes) removeObjective(g, o)
    b.stunUntil = g.time + 2.5
    g.ev({ t: 'bossSkill', s: 'shieldBreak' })
    g.ev({ t: 'toast', msg: '護盾破碎！Boss 暈眩了！', kind: 'good' })
  }
}

/** 對 Boss 造成傷害（護盾/正面減傷/暈眩加成） */
export function damageBoss(g: Game, dmg: number, ownerId?: string, srcX?: number, srcY?: number): void {
  const b = g.boss
  if (!b) return
  let d = dmg
  const owner = ownerId ? g.players.get(ownerId) : null
  d *= 1 + g.team.bossDamage
  // 獵魔專精：對 Boss 傷害 +30%/層
  if (owner) d *= 1 + 0.3 * eff(owner, 'eliteDmg')
  // 符文護盾期間大幅減傷
  if (b.shield > 0) d *= 0.1
  // 南瓜戰車正面減傷（暈眩時失效）
  const frontDr = b.data.skillParams.charge?.frontDr
  if (frontDr && b.stunUntil <= g.time && srcX !== undefined) {
    const [fx, fy] = [Math.cos(b.frontAng), Math.sin(b.frontAng)]
    const [sx, sy] = norm(srcX - b.x, (srcY ?? b.y) - b.y)
    if (fx * sx + fy * sy > 0.3) d *= 1 - frontDr
  }
  if (b.stunUntil > g.time) d *= 1.3
  d = Math.max(1, Math.round(d))
  b.hp -= d
  g.ev({ t: 'hit', i: -1, d, x: Math.round(b.x), y: Math.round(b.y) })
  if (owner) { owner.wave.dmgDealt += d; owner.total.dmgDealt += d }
  if (b.hp <= 0) {
    b.hp = 0
    g.ev({ t: 'bossDead' })
    g.ev({ t: 'toast', msg: `🎉 擊敗 ${b.data.name}！`, kind: 'good' })
    // 獎勵掉落
    dropsFromKill(g, b.x, b.y, { xpSize: 3, coinChance: 1, elite: true, boss: true })
    for (const o of g.objectives.filter(o => o.t === 'rune' || o.t === 'pillar')) removeObjective(g, o)
    g.fog = null
    if (g.mission && g.mission.data.type === 'survive') g.mission.done = true
    g.boss = null
    g.bossDefeated = true
  }
}

/** Boss 投射物/近戰命中檢測由 combat.ts 的投射物迴圈呼叫 */
export function tryHitBoss(g: Game, x: number, y: number, radius: number): boolean {
  const b = g.boss
  if (!b) return false
  return dist2(x, y, b.x, b.y) < (b.data.radius + radius) ** 2
}
