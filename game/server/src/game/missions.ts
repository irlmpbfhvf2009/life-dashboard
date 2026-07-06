// 任務目標 + 地圖事件 hook + 地圖物件（objectives）。
// 全部任務支援 1~4 人：count 型乘 killTargetScale、機關型查 OBJECT_COUNT。
import { MISSIONS, ENEMY_MAP, ITEMS } from '../../../shared/content/index'
import { MISSION, OBJECT_COUNT, PLAYER_SCALING, ARENA, TRAPS } from '../../../shared/balance'
import { weightedR, intR } from '../../../shared/rng'
import type { MissionData } from '../../../shared/types'
import type { SObjective } from './state'
import type { Game } from './game'
import { dist2, nextId, clampArena } from './util'
import { spawnEnemy } from './enemies'
import { spawnDrop, addReviveShard, healPlayer } from './drops'

// -------------------------------------------------------- objectives 基礎

export function spawnObjective(g: Game, o: Omit<SObjective, 'i' | 'tick'>): SObjective {
  const obj: SObjective = { ...o, i: nextId(), tick: 0 }
  clampArena(obj, 60)
  g.objectives.push(obj)
  g.ev({ t: 'objSpawn', o: { i: obj.i, t: obj.t, x: Math.round(obj.x), y: Math.round(obj.y), hp: obj.hp, mhp: obj.maxHp, pg: obj.pg, r: obj.r, s: obj.s, k: obj.k } })
  return obj
}

export function removeObjective(g: Game, o: SObjective): void {
  g.objectives = g.objectives.filter(x => x !== o)
  g.ev({ t: 'objRemove', i: o.i })
}

/** 地圖裝飾物件（可破壞掉寶） */
export function spawnProps(g: Game): void {
  for (let k = 0; k < g.zone.propCount; k++) {
    const kind = g.zone.props[Math.floor(g.rng() * g.zone.props.length)]
    spawnObjective(g, {
      t: 'prop', k: kind,
      x: 100 + g.rng() * (ARENA.w - 200), y: 100 + g.rng() * (ARENA.h - 200),
      hp: 14, maxHp: 14, pg: 0, r: 22, s: 0,
    })
  }
}

// -------------------------------------------------------- 隨機陷阱（尖刺/毒沼，站上去持續扣血）
const TRAP_KINDS = ['spike', 'poison', 'fire']

export function spawnTraps(g: Game): void {
  if (g.wave < TRAPS.fromWave) return
  const n = TRAPS.count(g.wave)
  const cx = ARENA.w / 2, cy = ARENA.h / 2
  for (let k = 0; k < n; k++) {
    let x = 0, y = 0
    for (let tries = 0; tries < 6; tries++) {
      x = 120 + g.rng() * (ARENA.w - 240)
      y = 120 + g.rng() * (ARENA.h - 240)
      if (dist2(x, y, cx, cy) > TRAPS.minDistFromCenter ** 2) break
    }
    spawnObjective(g, {
      t: 'trap', k: TRAP_KINDS[Math.floor(g.rng() * TRAP_KINDS.length)],
      x, y, hp: 1, maxHp: 1, pg: 0, r: TRAPS.radius, s: 0,
    })
  }
}

export function trapsTick(g: Game, dt: number): void {
  for (const o of g.objectives) {
    if (o.t !== 'trap') continue
    o.tick -= dt
    if (o.tick > 0) continue
    o.tick = TRAPS.tickInterval
    o.s = 0
    for (const p of g.players.values()) {
      if (p.status !== 'alive') continue
      if (dist2(p.x, p.y, o.x, o.y) < o.r * o.r) {
        o.s = 1                                   // 有人踩到 → client 顯示啟動
        g.damagePlayer(p, TRAPS.damage * (o.k === 'fire' ? 1.4 : 1))
      }
    }
  }
}

export function onPropDestroyed(g: Game, o: SObjective): void {
  switch (o.k) {
    case 'barrel': spawnDrop(g, 'coin', o.x, o.y, intR(g.rng, 2, 5)); break
    case 'coinBox': for (let k = 0; k < 3; k++) spawnDrop(g, 'coin', o.x + (g.rng() - 0.5) * 40, o.y + (g.rng() - 0.5) * 40, intR(g.rng, 2, 4)); break
    case 'healHerb': spawnDrop(g, 'heart', o.x, o.y, 20); break
    case 'crate': if (g.rng() < 0.5) spawnDrop(g, 'item', o.x, o.y, 0, weightedR(g.rng, ITEMS).id); break
    case 'mushroom':
      g.zones.push({ x: o.x, y: o.y, radius: 60, dps: 4, hps: 0, until: g.time + 3, ownerId: null, kind: 'poison', hostile: true, tick: 0 })
      break
  }
}

// -------------------------------------------------------- 任務

export function rollMission(g: Game): MissionData | null {
  if (g.wave < MISSION.minWave) return g.wave === 1 ? MISSIONS[0] : (g.rng() < 0.5 ? MISSIONS[0] : null)
  if (g.rng() > MISSION.chancePerWave) return MISSIONS[0]     // 沒抽到 → 純生存
  const pool = MISSIONS.filter(m => g.wave >= m.minWave)
  return weightedR(g.rng, pool.map(m => ({ ...m, w: 1 })))
}

export function setupMission(g: Game): void {
  const m = g.mission
  if (!m) return
  const players = g.playerCount
  const objN = OBJECT_COUNT[players]
  const objHpMult = (1 + g.team.objectiveHp) * PLAYER_SCALING[players].objective
  const anyUpg = [...g.players.values()].some(p => p.effects.has('objectiveHp'))
  const upgMult = anyUpg ? 1.2 : 1

  switch (m.data.type) {
    case 'kills':
      m.target = Math.round(m.data.baseTarget * MISSION.killTargetScale[players] * (1 + g.wave * 0.06))
      break
    case 'elite':
      m.target = Math.min(players, 2)
      g.forceEliteSpawns += m.target
      break
    case 'crystal': {
      m.target = 1
      spawnObjective(g, { t: 'crystal', x: ARENA.w / 2, y: ARENA.h / 2, hp: Math.round(220 * objHpMult * upgMult), maxHp: Math.round(220 * objHpMult * upgMult), pg: 0, r: 40, s: 1 })
      break
    }
    case 'cart': {
      m.target = 1
      const y = ARENA.h / 2 + (g.rng() - 0.5) * 400
      spawnObjective(g, {
        t: 'cart', x: 140, y, hp: Math.round(150 * objHpMult * upgMult), maxHp: Math.round(150 * objHpMult * upgMult), pg: 0, r: 34, s: 1,
        path: [{ x: 140, y }, { x: ARENA.w / 2, y: ARENA.h / 2 }, { x: ARENA.w - 140, y: ARENA.h - y }],
        pathIdx: 0,
      })
      break
    }
    case 'points': {
      m.target = 8   // 需累積的同時佔領秒數
      for (let k = 0; k < objN; k++) {
        spawnObjective(g, {
          t: 'point', x: ARENA.w * (0.25 + g.rng() * 0.5), y: ARENA.h * (0.25 + g.rng() * 0.5),
          hp: 1, maxHp: 1, pg: 0, r: 80, s: 0,
        })
      }
      break
    }
    case 'orbs':
      m.target = Math.round(m.data.baseTarget * MISSION.killTargetScale[players] * 0.6)
      break
    case 'nests': {
      m.target = Math.max(m.data.baseTarget, objN)
      for (let k = 0; k < m.target; k++) {
        spawnObjective(g, {
          t: 'nest', x: 150 + g.rng() * (ARENA.w - 300), y: 150 + g.rng() * (ARENA.h - 300),
          hp: Math.round(90 * objHpMult), maxHp: Math.round(90 * objHpMult), pg: 0, r: 34, s: 1,
        })
      }
      break
    }
    case 'base': {
      m.target = 1
      spawnObjective(g, { t: 'base', x: ARENA.w / 2, y: ARENA.h / 2, hp: Math.round(320 * objHpMult * upgMult), maxHp: Math.round(320 * objHpMult * upgMult), pg: 0, r: 60, s: 1 })
      break
    }
    case 'chestGuard': {
      m.target = m.data.baseTarget    // 守 20 秒
      spawnObjective(g, { t: 'guardChest', x: ARENA.w * (0.3 + g.rng() * 0.4), y: ARENA.h * (0.3 + g.rng() * 0.4), hp: 1, maxHp: 1, pg: 0, r: 42, s: 0 })
      break
    }
    default:
      m.target = 1
  }
}

export function missionTick(g: Game, dt: number): void {
  const m = g.mission
  if (!m || m.done || m.failed) return
  const alive = [...g.players.values()].filter(p => p.connected && p.status === 'alive')

  switch (m.data.type) {
    case 'survive':
      m.progress = Math.min(g.time / g.duration, 1) * 100
      if (g.time >= g.duration - 0.1) m.done = true
      return
    case 'kills': case 'elite': case 'orbs':
      if (m.progress >= m.target) m.done = true
      // 能量球任務：定期在場上放能量球
      if (m.data.type === 'orbs') {
        m.guardTimer -= dt
        if (m.guardTimer <= 0) {
          m.guardTimer = 3
          const orbs = g.drops.filter(d => d.t === 'orb').length
          if (orbs < 4) spawnDrop(g, 'orb', 120 + g.rng() * (ARENA.w - 240), 120 + g.rng() * (ARENA.h - 240), 1)
        }
      }
      return
    case 'crystal': case 'base': {
      const o = g.objectives.find(o => o.t === 'crystal' || o.t === 'base')
      if (!o || o.hp <= 0) { m.failed = true; g.ev({ t: 'toast', msg: '任務失敗：目標被摧毀了…', kind: 'warn' }) }
      else if (g.time >= g.duration - 0.1) m.done = true
      return
    }
    case 'cart': {
      const o = g.objectives.find(o => o.t === 'cart')
      if (!o) return
      if (o.hp <= 0) { m.failed = true; g.ev({ t: 'toast', msg: '任務失敗：菜車被拆了…', kind: 'warn' }); return }
      // 有玩家靠近才前進
      const near = alive.some(p => dist2(p.x, p.y, o.x, o.y) < 150 * 150)
      if (near && o.path && o.pathIdx! < o.path.length) {
        const wp = o.path[o.pathIdx!]
        const dd = Math.hypot(wp.x - o.x, wp.y - o.y)
        if (dd < 10) { o.pathIdx!++; if (o.pathIdx! >= o.path.length) { m.done = true; return } }
        else { o.x += (wp.x - o.x) / dd * 55 * dt; o.y += (wp.y - o.y) / dd * 55 * dt }
      }
      const totalLen = o.path!.length
      m.progress = Math.min(99, (o.pathIdx! / totalLen) * 100)
      return
    }
    case 'points': {
      const pads = g.objectives.filter(o => o.t === 'point')
      let occupied = 0
      for (const pad of pads) {
        const occ = alive.some(p => dist2(p.x, p.y, pad.x, pad.y) < pad.r * pad.r)
        pad.s = occ ? 1 : 0
        if (occ) occupied++
      }
      if (pads.length && occupied === pads.length) {
        m.progress += dt
        if (m.progress >= m.target) { m.done = true; for (const pad of pads) pad.s = 2 }
      }
      return
    }
    case 'nests':
      if (m.progress >= m.target) m.done = true
      // 巢穴持續生怪
      for (const o of g.objectives) {
        if (o.t !== 'nest' || o.s === 2) continue
        o.tick -= dt
        if (o.tick <= 0) {
          o.tick = 4.5
          const pool = g.zone.enemyPool.filter(x => (ENEMY_MAP.get(x.id)?.tier ?? 2) === 1)
          if (pool.length) spawnEnemy(g, weightedR(g.rng, pool).id, o.x + (g.rng() - 0.5) * 60, o.y + (g.rng() - 0.5) * 60, {})
        }
      }
      return
    case 'chestGuard': {
      const o = g.objectives.find(o => o.t === 'guardChest')
      if (!o) return
      if (o.s === 0) {
        // 靠近開箱
        if (alive.some(p => dist2(p.x, p.y, o.x, o.y) < (o.r + 30) ** 2)) {
          o.s = 1
          g.ev({ t: 'toast', msg: '寶箱已開啟！守住 20 秒！', kind: 'warn' })
          g.spawner.budgetLeft += 12   // 開箱加壓
        }
      } else if (o.s === 1) {
        m.progress += dt
        o.pg = m.progress / m.target
        if (m.progress >= m.target) {
          m.done = true; o.s = 2
          spawnDrop(g, 'chest', o.x, o.y)
        }
      }
      return
    }
  }
}

/** 任務完成獎勵（波次結束結算時發放） */
export function grantMissionRewards(g: Game): string[] {
  const m = g.mission
  if (!m || !m.done) return []
  const granted: string[] = []
  for (const r of m.data.rewards) {
    switch (r) {
      case 'gold': {
        const amt = 10 + Math.round(g.wave * 1.5)
        for (const p of g.players.values()) { p.gold += amt; p.wave.gold += amt }
        granted.push(`全隊金幣 +${amt}`)
        break
      }
      case 'freeUpgrade':
        for (const p of g.players.values()) p.pendingLevelups++
        granted.push('全隊免費升級 ×1')
        break
      case 'teamHeal':
        for (const p of g.players.values()) if (p.status === 'alive') healPlayer(g, p, p.stats.maxHp * 0.25)
        granted.push('全隊回血 25%')
        break
      case 'shopDiscount':
        g.nextShopDiscount = Math.max(g.nextShopDiscount, 0.15)
        granted.push('商店 85 折')
        break
      case 'rareBoost':
        g.nextRareBoost = 0.5
        granted.push('稀有機率提升')
        break
      case 'chest':
        for (const p of g.players.values()) if (p.status !== 'dead') { spawnDrop(g, 'chest', p.x, p.y); break }
        granted.push('寶箱 ×1')
        break
      case 'reviveShard':
        addReviveShard(g)
        granted.push('復活碎片 ×1')
        break
    }
  }
  return granted
}

// -------------------------------------------------------- 地圖事件 hook

export function eventTick(g: Game, dt: number): void {
  const ev = g.event
  if (!ev) return
  ev.tick -= dt
  switch (ev.data.hook) {
    case 'edgePoison': {
      if (ev.tick > 0) return
      ev.tick = 0.5
      const margin = 130
      for (const p of g.players.values()) {
        if (p.status !== 'alive') continue
        if (p.x < margin || p.x > ARENA.w - margin || p.y < margin || p.y > ARENA.h - margin) {
          g.damagePlayer(p, 3)
        }
      }
      return
    }
    case 'lightning': {
      if (ev.tick > 0) return
      ev.tick = 2.2 + g.rng() * 1.5
      const ps = [...g.players.values()].filter(p => p.status === 'alive')
      if (!ps.length) return
      const p = ps[Math.floor(g.rng() * ps.length)]
      const x = p.x + (g.rng() - 0.5) * 400
      const y = p.y + (g.rng() - 0.5) * 400
      g.pendingStrikes.push({ x, y, at: g.time + 1.2, radius: 85, damage: 14, kind: 'lightning' })
      g.ev({ t: 'aoe', x: Math.round(x), y: Math.round(y), r: 85, kind: 'telegraph' })
      return
    }
    case 'fireFloor': {
      if (ev.tick > 0) return
      ev.tick = 2.8
      const x = 150 + g.rng() * (ARENA.w - 300)
      const y = 150 + g.rng() * (ARENA.h - 300)
      g.pendingStrikes.push({ x, y, at: g.time + 1.0, radius: 100, damage: 8, kind: 'fire' })
      g.ev({ t: 'aoe', x: Math.round(x), y: Math.round(y), r: 100, kind: 'telegraph' })
      return
    }
    case 'healFountain':
      // 波開始時 setup 已放置治療泉，無需 tick
      return
  }
}

export function setupEventObjects(g: Game): void {
  if (g.event?.data.hook === 'healFountain') {
    g.zones.push({
      x: ARENA.w / 2, y: ARENA.h / 2, radius: 130, dps: 0, hps: 5,
      until: g.time + g.duration, ownerId: null, kind: 'heal', hostile: true, tick: 0,
    })
  }
  const chestBonus = (g.eventMods.chestBonus ?? 0) + g.routeMods.chestMult
  for (let k = 0; k < chestBonus; k++) {
    spawnDrop(g, 'chest', 150 + g.rng() * (ARENA.w - 300), 150 + g.rng() * (ARENA.h - 300))
  }
}

/** 延遲落點打擊（雷/火）結算 */
export function strikesTick(g: Game): void {
  for (const s of g.pendingStrikes) {
    if (g.time < s.at) continue
    g.ev({ t: 'aoe', x: Math.round(s.x), y: Math.round(s.y), r: s.radius, kind: s.kind === 'poisonStay' ? 'poison' : s.kind })
    for (const p of g.players.values()) {
      if (p.status === 'alive' && dist2(p.x, p.y, s.x, s.y) < s.radius * s.radius) g.damagePlayer(p, s.damage)
    }
    if (s.kind === 'fire') {
      g.zones.push({ x: s.x, y: s.y, radius: s.radius, dps: 6, hps: 0, until: g.time + 3, ownerId: null, kind: 'fire', hostile: true, tick: 0 })
    }
    if (s.kind === 'poisonStay') {
      g.zones.push({ x: s.x, y: s.y, radius: s.radius, dps: s.damage, hps: 0, until: g.time + 4, ownerId: null, kind: 'poison', hostile: true, tick: 0 })
    }
    s.at = -1
  }
  g.pendingStrikes = g.pendingStrikes.filter(s => s.at >= 0)
}
