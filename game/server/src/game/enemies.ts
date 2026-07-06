// 怪物：生成器（budget-based）、10 種 behavior AI、傷害/擊殺管線、詞綴。
import { ENEMY_MAP, TIER_COST, AFFIXES, AFFIX_MAP } from '../../../shared/content/index'
import {
  PLAYER_SCALING, DIFFICULTIES, enemyHpScale, enemyDmgScale,
  eliteChance, endlessAffixCount, ARENA, caps,
} from '../../../shared/balance'
import { weightedR } from '../../../shared/rng'
import type { EnemyData } from '../../../shared/types'
import type { SEnemy, SPlayer } from './state'
import type { Game } from './game'
import { dist2, norm, nextId, clampArena, clamp } from './util'
import { spawnMult, eliteAllowed } from './director'
import { dropsFromKill } from './drops'
import { eff } from './stats'

// -------------------------------------------------------- 生成

export function spawnEnemy(g: Game, id: string, x: number, y: number, opts: {
  elite?: boolean; affixIds?: string[]; child?: boolean; hpMultOverride?: number
} = {}): SEnemy | null {
  const data = ENEMY_MAP.get(id)
  if (!data) return null
  const cp = caps(g.playerCount)
  if (g.enemies.length >= cp.enemies) return null
  if (opts.elite && g.enemies.filter(e => e.elite).length >= cp.elites) opts.elite = false

  const diff = DIFFICULTIES[g.difficulty] ?? DIFFICULTIES[0]
  const globalAffix = endlessAffixCount(g.wave)
  let hp = data.baseHp * enemyHpScale(g.wave) * PLAYER_SCALING[g.playerCount].hp * diff.enemyHp * (1 + globalAffix * 0.1)
  let speed = data.speed * (g.eventMods.enemySpeedMult ?? 1) * (1 + globalAffix * 0.04)
  let damage = data.damage * enemyDmgScale(g.wave) * diff.enemyDmg
  let size = 1
  let dr = 0

  const affixes = (opts.affixIds ?? []).map(a => AFFIX_MAP.get(a)!).filter(Boolean)
  if (opts.elite) {
    hp *= 6; damage *= 1.5; size *= 1.3
    if (!affixes.length) {
      const n = g.wave >= 12 ? 2 : 1
      const pool = AFFIXES.slice()
      for (let k = 0; k < n; k++) {
        const a = weightedR(g.rng, pool)
        if (!affixes.includes(a)) affixes.push(a)
      }
    }
  }
  for (const a of affixes) {
    hp *= a.hpMult ?? 1
    speed *= a.speedMult ?? 1
    damage *= a.damageMult ?? 1
    size *= a.sizeMult ?? 1
    dr = Math.max(dr, a.damageReduction ?? 0)
  }
  if (opts.child) { hp *= 0.35; size *= 0.65 }
  if (opts.hpMultOverride) hp *= opts.hpMultOverride

  // 怪物移速受詛咒「貪婪契約」影響（任何玩家持有即生效）
  for (const p of g.players.values()) if (eff(p, 'curseGreed')) { speed *= 1.1; break }

  const e: SEnemy = {
    i: nextId(), data, x, y,
    hp: Math.round(hp), maxHp: Math.round(hp),
    speed, damage, radius: data.radius * size, dr,
    affixes, elite: !!opts.elite, sizeMult: size,
    shield: 0, frozenUntil: 0, slowUntil: 0, slowPct: 0, stunUntil: 0,
    kbVx: 0, kbVy: 0, touchCd: 0,
    actCd: (data.params?.shootCd ?? data.params?.lungeCd ?? data.params?.summonCd ?? 2) * (0.5 + g.rng()),
    fuse: -1, fleeUntil: 0, stolenGold: 0,
    lungeVx: 0, lungeVy: 0, lungeUntil: 0,
    shieldTick: 0, trailTick: 0, targetId: null, splitChild: !!opts.child,
    burnDps: 0, burnUntil: 0,
  }
  clampArena(e, 10)
  g.enemies.push(e)
  g.ev({
    t: 'spawn',
    e: {
      i: e.i, k: data.id, x: Math.round(e.x), y: Math.round(e.y), mhp: e.maxHp,
      e: e.elite ? 1 : undefined, a: affixes.length ? affixes.map(a => a.id) : undefined,
      sz: size !== 1 ? Math.round(size * 100) / 100 : undefined,
    },
  })
  return e
}

/** 場邊生成點（避開玩家 300 內） */
export function edgeSpawnPos(g: Game): { x: number; y: number } {
  for (let tries = 0; tries < 8; tries++) {
    const side = Math.floor(g.rng() * 4)
    const t = g.rng()
    const pos = side === 0 ? { x: t * ARENA.w, y: 30 }
      : side === 1 ? { x: t * ARENA.w, y: ARENA.h - 30 }
      : side === 2 ? { x: 30, y: t * ARENA.h }
      : { x: ARENA.w - 30, y: t * ARENA.h }
    let ok = true
    for (const p of g.players.values()) {
      if (p.status === 'alive' && dist2(pos.x, pos.y, p.x, p.y) < 300 * 300) { ok = false; break }
    }
    if (ok) return pos
  }
  return { x: g.rng() * ARENA.w, y: 30 }
}

/** 生成器 tick：把整波預算平均撒在波次時間內，受導演倍率調節 */
export function spawnerTick(g: Game, dt: number): void {
  if (g.time < 0.5) return
  if (g.time >= g.duration && !g.boss) return             // 倒數結束後不再生，剩下的怪要清光
  if (g.director.spawnPauseUntil > g.time) return
  g.spawner.timer -= dt * spawnMult(g)
  if (g.spawner.timer > 0 || g.spawner.budgetLeft <= 0) return

  // 每次生成一小群（30 秒短波 → 群體更大、鋪得更快）
  const groupSize = Math.min(4 + Math.floor(g.wave / 3), 10)
  const pos = edgeSpawnPos(g)
  for (let k = 0; k < groupSize && g.spawner.budgetLeft > 0; k++) {
    const pick = pickFromPool(g)
    if (!pick) break
    const isElite = eliteAllowed(g) && g.rng() < eliteChance(g.wave) * (g.eventMods.eliteChanceMult ?? 1)
    const e = spawnEnemy(g, pick.id, pos.x + (g.rng() - 0.5) * 120, pos.y + (g.rng() - 0.5) * 120, { elite: isElite })
    if (!e) break
    g.spawner.budgetLeft -= TIER_COST[pick.tier] * (isElite ? 4 : 1)
  }
  // 生成節奏：預算越多剩越密集
  const pace = g.duration / Math.max(6, g.spawner.budgetTotal / 2.4)
  g.spawner.timer = pace * (0.7 + g.rng() * 0.6)
}

function pickFromPool(g: Game): EnemyData | null {
  const pool = g.zone.enemyPool
    .filter(en => g.wave >= (en.fromWave ?? 1))
    .map(en => ({ ...en, data: ENEMY_MAP.get(en.id)! }))
    .filter(en => en.data)
    // 路線「遠程怪增加」偏壓
    .map(en => ({ ...en, w: en.w * (en.data.behavior === 'ranged' ? 1 + g.routeMods.rangedBias : 1) }))
  if (!pool.length) return null
  return weightedR(g.rng, pool).data
}

// -------------------------------------------------------- AI

function pickTarget(g: Game, e: SEnemy): { x: number; y: number; player?: SPlayer; objIdx?: number } | null {
  // 任務目標（水晶/推車/糧倉）：40% 的怪固定衝目標
  if (e.targetId?.startsWith('obj:')) {
    const idx = Number(e.targetId.slice(4))
    const o = g.objectives.find(o => o.i === idx && o.s !== 2 && o.hp > 0)
    if (o) return { x: o.x, y: o.y, objIdx: o.i }
    e.targetId = null
  }
  const ps = [...g.players.values()].filter(p => p.connected && (p.status === 'alive' || p.status === 'downed'))
  if (!ps.length) return null
  const alive = ps.filter(p => p.status === 'alive')
  const pool = alive.length ? alive : ps
  const stalk = e.affixes.some(a => a.targetLowestHp)
  let best: SPlayer | null = null
  let bd = Infinity
  for (const p of pool) {
    const d = stalk ? p.hp / Math.max(1, p.stats.maxHp) * 1e6 : dist2(e.x, e.y, p.x, p.y)
    if (d < bd) { bd = d; best = p }
  }
  return best ? { x: best.x, y: best.y, player: best } : null
}

export function enemiesTick(g: Game, dt: number): void {
  const now = g.time
  for (const e of g.enemies) {
    if (e.hp <= 0) continue
    // 持續傷害（毒/燃燒）
    if (e.burnUntil > now) {
      e.hp -= e.burnDps * dt
      if (e.hp <= 0) { killEnemy(g, e, null); continue }
    }
    // 護盾詞綴
    if (e.affixes.some(a => a.periodicShield)) {
      e.shieldTick -= dt
      if (e.shieldTick <= 0) {
        e.shieldTick = e.affixes.find(a => a.periodicShield)!.periodicShield!
        e.shield = Math.round(e.maxHp * 0.15)
      }
    }
    // 擊退慣性
    if (Math.abs(e.kbVx) > 1 || Math.abs(e.kbVy) > 1) {
      e.x += e.kbVx * dt; e.y += e.kbVy * dt
      e.kbVx *= 0.85; e.kbVy *= 0.85
    }
    if (e.frozenUntil > now || e.stunUntil > now) { clampArena(e, 10); continue }

    const slowMult = e.slowUntil > now ? 1 - e.slowPct : 1
    const spd = e.speed * slowMult

    // 毒霧詞綴：路徑留毒
    if (e.affixes.some(a => a.trail === 'poison')) {
      e.trailTick -= dt
      if (e.trailTick <= 0) {
        e.trailTick = 0.8
        g.zones.push({ x: e.x, y: e.y, radius: 46, dps: 5, hps: 0, until: now + 2.5, ownerId: null, kind: 'poison', hostile: true, tick: 0 })
      }
    }

    const tgt = pickTarget(g, e)
    if (!tgt) continue
    const dd = Math.sqrt(dist2(e.x, e.y, tgt.x, tgt.y))
    const [nx, ny] = norm(tgt.x - e.x, tgt.y - e.y)
    e.touchCd -= dt
    e.actCd -= dt

    switch (e.data.behavior) {
      case 'chase': case 'fast': case 'tank':
        moveAndTouch(g, e, nx, ny, spd, dd, tgt, dt)
        break
      case 'ranged': {
        const prm = e.data.params!
        if (dd > prm.shootRange * 0.85) {
          e.x += nx * spd * dt; e.y += ny * spd * dt
        } else if (e.actCd <= 0 && tgt.player) {
          e.actCd = prm.shootCd
          if (g.enemyProjs.length < caps(g.playerCount).enemyProjectiles) {
            g.enemyProjs.push({ x: e.x, y: e.y, vx: nx * prm.projSpeed, vy: ny * prm.projSpeed, damage: e.damage, left: 600 })
          }
        }
        moveAndTouch(g, e, 0, 0, 0, dd, tgt, dt)
        break
      }
      case 'exploder': {
        const prm = e.data.params!
        if (e.fuse >= 0) {
          e.fuse -= dt
          if (e.fuse <= 0) {
            g.ev({ t: 'aoe', x: e.x, y: e.y, r: prm.blastRadius, kind: 'explosion' })
            for (const p of g.players.values()) {
              if (p.status === 'alive' && dist2(p.x, p.y, e.x, e.y) < prm.blastRadius ** 2) g.damagePlayer(p, e.damage)
            }
            e.hp = 0
            removeEnemy(g, e, true)
          }
        } else if (dd < 64) {
          e.fuse = prm.fuse
        } else {
          e.x += nx * spd * 1.15 * dt; e.y += ny * spd * 1.15 * dt
        }
        break
      }
      case 'shielded':
        moveAndTouch(g, e, nx, ny, spd, dd, tgt, dt)
        break
      case 'summoner': {
        const prm = e.data.params!
        // 與玩家保持距離
        if (dd < 260) { e.x -= nx * spd * dt; e.y -= ny * spd * dt }
        else if (dd > 420) { e.x += nx * spd * dt; e.y += ny * spd * dt }
        if (e.actCd <= 0) {
          e.actCd = prm.summonCd
          for (let k = 0; k < prm.summonCount; k++) {
            const pool = g.zone.enemyPool.filter(x => (ENEMY_MAP.get(x.id)?.tier ?? 2) === 1)
            const id = pool.length ? weightedR(g.rng, pool).id : 'slug'
            spawnEnemy(g, id, e.x + (g.rng() - 0.5) * 90, e.y + (g.rng() - 0.5) * 90, {})
          }
          g.ev({ t: 'aoe', x: e.x, y: e.y, r: 70, kind: 'summon' })
        }
        break
      }
      case 'toxic':
        moveAndTouch(g, e, nx, ny, spd, dd, tgt, dt)
        break
      case 'lunger': {
        const prm = e.data.params!
        if (e.lungeUntil > now) {
          e.x += e.lungeVx * dt; e.y += e.lungeVy * dt
          touchAttack(g, e, tgt, dd, dt)
        } else if (e.actCd <= 0 && dd < prm.lungeDist * 1.8 && dd > 60) {
          e.actCd = prm.lungeCd
          e.lungeUntil = now + prm.lungeDist / prm.lungeSpeed
          e.lungeVx = nx * prm.lungeSpeed; e.lungeVy = ny * prm.lungeSpeed
        } else {
          moveAndTouch(g, e, nx, ny, spd * 0.8, dd, tgt, dt)
        }
        break
      }
      case 'thief': {
        const prm = e.data.params!
        if (e.fleeUntil > 0) {
          // 偷到錢往場邊逃
          e.x -= nx * spd * 1.2 * dt; e.y -= ny * spd * 1.2 * dt
          if (now > e.fleeUntil) { removeEnemy(g, e, false); continue }
        } else {
          e.x += nx * spd * dt; e.y += ny * spd * dt
          if (tgt.player && dd < e.radius + 22 && e.touchCd <= 0) {
            const steal = Math.min(tgt.player.gold, prm.stealAmount)
            tgt.player.gold -= steal
            e.stolenGold += steal
            e.fleeUntil = now + prm.fleeTime
            g.ev({ t: 'toast', msg: `扒手鼠偷走 ${tgt.player.name} 的 ${steal} 金幣！`, kind: 'warn' })
          }
        }
        break
      }
    }
    clampArena(e, 10)
  }
  // 清理死亡
  g.enemies = g.enemies.filter(e => {
    if (e.hp > 0) return true
    killEnemy(g, e, null)
    return false
  })
}

function moveAndTouch(g: Game, e: SEnemy, nx: number, ny: number, spd: number, dd: number, tgt: ReturnType<typeof pickTarget>, dt: number): void {
  if (dd > e.radius + 16) { e.x += nx * spd * dt; e.y += ny * spd * dt }
  touchAttack(g, e, tgt, dd, dt)
}

function touchAttack(g: Game, e: SEnemy, tgt: ReturnType<typeof pickTarget>, dd: number, _dt: number): void {
  if (!tgt || e.touchCd > 0) return
  // 攻擊任務目標
  if (tgt.objIdx !== undefined) {
    const o = g.objectives.find(o => o.i === tgt.objIdx)
    if (o && dd < e.radius + o.r + 6) {
      e.touchCd = 0.9
      g.damageObjective(o, e.damage)
    }
    return
  }
  if (tgt.player && tgt.player.status === 'alive' && dd < e.radius + 24) {
    e.touchCd = 0.9
    g.damagePlayer(tgt.player, e.damage)
  }
}

// -------------------------------------------------------- 傷害 / 擊殺

export interface DamageOpts {
  ownerId?: string
  crit?: boolean
  knockX?: number; knockY?: number
  srcX?: number; srcY?: number
}

export function damageEnemyImpl(g: Game, e: SEnemy, dmg: number, opts: DamageOpts = {}): number {
  if (e.hp <= 0) return 0
  let d = dmg * (1 - e.dr)
  // 盾殼蟲正面減傷
  if (e.data.behavior === 'shielded' && opts.srcX !== undefined) {
    const tgt = pickTarget(g, e)
    if (tgt) {
      const [fx, fy] = norm(tgt.x - e.x, tgt.y - e.y)
      const [sx, sy] = norm(opts.srcX! - e.x, opts.srcY! - e.y)
      const dot = fx * sx + fy * sy
      const arc = Math.cos(((e.data.params?.arcDeg ?? 100) / 2) * Math.PI / 180)
      if (dot > arc) d *= 1 - (e.data.params?.frontDr ?? 0.5)
    }
  }
  d = Math.max(1, Math.round(d))
  if (e.shield > 0) {
    const absorbed = Math.min(e.shield, d)
    e.shield -= absorbed
    d -= absorbed
  }
  e.hp -= d
  if (opts.knockX || opts.knockY) {
    const resist = e.data.tier === 3 ? 0.3 : e.data.tier === 2 ? 0.6 : 1
    e.kbVx += (opts.knockX ?? 0) * resist
    e.kbVy += (opts.knockY ?? 0) * resist
  }
  if (d > 0) g.ev({ t: 'hit', i: e.i, d, crit: opts.crit ? 1 : undefined, x: Math.round(e.x), y: Math.round(e.y) })
  if (e.hp <= 0) {
    killEnemy(g, e, opts.ownerId ?? null)
    g.enemies = g.enemies.filter(x => x !== e)
  }
  return d
}

function removeEnemy(g: Game, e: SEnemy, exploded: boolean): void {
  g.enemies = g.enemies.filter(x => x !== e)
  g.ev({ t: exploded ? 'kill' : 'despawn', i: e.i, x: Math.round(e.x), y: Math.round(e.y) } as never)
}

let killGuard = new WeakSet<SEnemy>()

export function killEnemy(g: Game, e: SEnemy, byPlayerId: string | null): void {
  if (killGuard.has(e)) return
  killGuard.add(e)
  const p = byPlayerId ? g.players.get(byPlayerId) : null
  g.ev({ t: 'kill', i: e.i, x: Math.round(e.x), y: Math.round(e.y), by: byPlayerId ?? undefined })
  g.director.recentKills.push(g.time)

  if (p) {
    p.wave.kills++; p.total.kills++
    if (p.stats.lifeOnKill) g.healEv(p, p.stats.lifeOnKill)
    if (e.elite && eff(p, 'eliteTrophy')) {
      p.eliteTrophyStacks++
      g.ev({ t: 'toast', msg: `獵人勳章：傷害永久 +3%（×${p.eliteTrophyStacks}）`, kind: 'good' })
    }
    // 連鎖收割
    if (eff(p, 'killExplode') && g.rng() < 0.08) {
      g.ev({ t: 'aoe', x: e.x, y: e.y, r: 110, kind: 'explosion' })
      for (const o of g.enemies) {
        if (o !== e && o.hp > 0 && dist2(o.x, o.y, e.x, e.y) < 110 * 110) damageEnemyImpl(g, o, 20 * p.stats.damage, { ownerId: p.id })
      }
    }
  }
  if (g.mission && !g.mission.done) {
    if (g.mission.data.type === 'kills') g.mission.progress++
    if (g.mission.data.type === 'elite' && e.elite) g.mission.progress++
  }

  // 詞綴死亡效果
  for (const a of e.affixes) {
    if (a.onDeath === 'explode') {
      g.ev({ t: 'aoe', x: e.x, y: e.y, r: 90, kind: 'explosion' })
      for (const q of g.players.values()) {
        if (q.status === 'alive' && dist2(q.x, q.y, e.x, e.y) < 90 * 90) g.damagePlayer(q, e.damage * 0.8)
      }
    }
    if (a.onDeath === 'split' && !e.splitChild) {
      for (let k = 0; k < 2; k++) {
        spawnEnemy(g, e.data.id, e.x + (g.rng() - 0.5) * 50, e.y + (g.rng() - 0.5) * 50, { child: true, affixIds: [] })
      }
    }
  }
  // 毒怪死後毒圈
  if (e.data.behavior === 'toxic') {
    const prm = e.data.params!
    g.zones.push({ x: e.x, y: e.y, radius: prm.poolRadius, dps: prm.poolDps, hps: 0, until: g.time + prm.poolDuration, ownerId: null, kind: 'poison', hostile: true, tick: 0 })
    g.ev({ t: 'aoe', x: e.x, y: e.y, r: prm.poolRadius, kind: 'poison' })
  }
  // 扒手鼠掉回贓款
  if (e.stolenGold > 0) g.dropGold(e.x, e.y, e.stolenGold)

  dropsFromKill(g, e.x, e.y, { xpSize: e.data.xpSize, coinChance: e.data.coinChance, elite: e.elite })
}
