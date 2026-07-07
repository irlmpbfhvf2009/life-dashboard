// 玩家武器行為模擬：9 種 behavior 一次寫好，之後加武器基本只加資料。
// 命中結果全部在 server 判定；client 只畫視覺投射物。
import { weaponStatsAt } from '../../../shared/content/index'
import type { WeaponStats } from '../../../shared/types'
import type { SPlayer, OwnedWeapon, SProjectile } from './state'
import type { Game } from './game'
import { dist2, norm, clampArena } from './util'
import { damageEnemyImpl } from './enemies'
import { damageBoss, tryHitBoss } from './boss'
import { eff } from './stats'
import { healPlayer } from './drops'

// -------------------------------------------------------- 每 tick 武器驅動

export function weaponsTick(g: Game, dt: number): void {
  for (const p of g.players.values()) {
    if (!p.connected || p.status !== 'alive') continue
    const atkSpd = attackSpeedOf(g, p)
    for (const w of p.weapons) {
      w.cdLeft -= dt * atkSpd
      const st = effectiveStats(g, p, w)
      switch (w.data.behavior) {
        case 'projectile': fireProjectile(g, p, w, st); break
        case 'drone': fireDrone(g, p, w, st, dt); break
        case 'orbit': tickOrbit(g, p, w, st, dt); break
        case 'melee': fireMelee(g, p, w, st); break
        case 'chain': fireChain(g, p, w, st); break
        case 'mine': fireMine(g, p, w, st); break
        case 'turret': fireTurret(g, p, w, st); break
        case 'healPulse': fireHeal(g, p, w, st); break
        case 'zone': fireZone(g, p, w, st); break
      }
    }
  }
  projectilesTick(g, dt)
  minesTick(g, dt)
  turretsTick(g, dt)
  zonesTick(g, dt)
}

function attackSpeedOf(g: Game, p: SPlayer): number {
  let s = p.stats.attackSpeed
  if (p.buffs.rageUntil > g.time) s *= 1 + p.buffs.rageAmt
  return s
}

/** 武器等級數值 + 玩家加成（範圍/穿透/投射物/特化升級） */
function effectiveStats(g: Game, p: SPlayer, w: OwnedWeapon): WeaponStats {
  const st = { ...weaponStatsAt(w.data, w.level) }
  const isRanged = w.data.category === 'ranged'
  if (p.char.passive.effect === 'rangedRangeBoost' && isRanged) st.range *= 1.15
  if (p.char.passive.effect === 'engineerBoost' && w.data.category === 'engineer') {
    st.damage *= 1.25; st.cooldown *= 0.85
  }
  if (eff(p, 'engineerCd') && w.data.category === 'engineer') st.cooldown *= 1 - 0.15 * eff(p, 'engineerCd')
  if (eff(p, 'projSpeed')) { st.speed = (st.speed ?? 480) * (1 + 0.25 * eff(p, 'projSpeed')); st.range *= 1 + 0.1 * eff(p, 'projSpeed') }
  if (eff(p, 'meleeRange') && w.data.category === 'melee') st.radius = (st.radius ?? 100) * (1 + 0.2 * eff(p, 'meleeRange'))
  if (eff(p, 'knockbackUp')) st.knockback *= 1 + 0.4 * eff(p, 'knockbackUp')
  if (eff(p, 'chainPlus') && st.chains) st.chains += eff(p, 'chainPlus')
  if (eff(p, 'turretDuration') && w.data.behavior === 'turret') st.duration = (st.duration ?? 8) * (1 + 0.4 * eff(p, 'turretDuration'))
  if (eff(p, 'frostDuration') && w.data.tags.includes('frost')) st.duration = (st.duration ?? 2) * (1 + 0.3 * eff(p, 'frostDuration'))
  if (eff(p, 'dotUp') && st.burn) st.burn *= 1 + 0.3 * eff(p, 'dotUp')
  // 範圍加成
  if (st.radius) st.radius *= p.stats.area
  // 投射物加成
  st.projectileCount += p.stats.projectiles
  st.pierce += p.stats.pierce
  return st
}

/** 傷害合成（含站位合作加成/暴擊） */
export function rollDamage(g: Game, p: SPlayer, base: number, critMod = 1): { dmg: number; crit: boolean } {
  let mult = p.stats.damage
  if (eff(p, 'nearAllyDamage')) {
    for (const q of g.players.values()) {
      if (q !== p && q.status === 'alive' && dist2(p.x, p.y, q.x, q.y) < 160 * 160) {
        mult *= 1 + 0.1 * eff(p, 'nearAllyDamage')
        break
      }
    }
  }
  const crit = g.rng() < p.stats.critChance * critMod
  if (crit) mult *= p.stats.critDamage
  else if (eff(p, 'curseEdge')) mult *= 0.8
  return { dmg: base * mult, crit }
}

function nearestEnemy(g: Game, x: number, y: number, range: number): { e: typeof g.enemies[number]; d2: number } | null {
  let best = null as { e: typeof g.enemies[number]; d2: number } | null
  const r2 = range * range
  for (const e of g.enemies) {
    if (e.hp <= 0) continue
    const d2 = dist2(x, y, e.x, e.y)
    if (d2 < r2 && (!best || d2 < best.d2)) best = { e, d2 }
  }
  return best
}

// -------------------------------------------------------- 各 behavior

/** 可被武器打壞的地圖物件（箱子/木桶/巢穴/毒菇柱） */
function destructibles(g: Game) {
  return g.objectives.filter(o => (o.t === 'prop' || o.t === 'nest' || o.t === 'pillar') && o.s !== 2 && o.hp > 0)
}

/** 最近可攻擊目標座標：怪 → Boss → 可破壞物（沒怪的時候順手拆箱） */
function nearestTargetPos(g: Game, x: number, y: number, range: number): { x: number; y: number } | null {
  const tgt = nearestEnemy(g, x, y, range)
  if (tgt) return { x: tgt.e.x, y: tgt.e.y }
  const b = g.boss
  if (b && dist2(x, y, b.x, b.y) < (range + b.data.radius) ** 2) return { x: b.x, y: b.y }
  let best: { x: number; y: number } | null = null
  let bd = range * range
  for (const o of destructibles(g)) {
    const d2 = dist2(x, y, o.x, o.y)
    if (d2 < bd) { bd = d2; best = { x: o.x, y: o.y } }
  }
  return best
}

function fireProjectile(g: Game, p: SPlayer, w: OwnedWeapon, st: WeaponStats): void {
  if (w.cdLeft > 0) return
  const tgt = nearestTargetPos(g, p.x, p.y, st.range)
  if (!tgt) { w.cdLeft = 0.08; return }
  w.cdLeft = st.cooldown
  spawnVolley(g, p, w, st, p.x, p.y, tgt.x, tgt.y)
}

function fireDrone(g: Game, p: SPlayer, w: OwnedWeapon, st: WeaponStats, dt: number): void {
  w.orbitAngle += dt * 2.2
  const dx = p.x + Math.cos(w.orbitAngle) * 52
  const dy = p.y + Math.sin(w.orbitAngle) * 52 - 30
  if (w.cdLeft > 0) return
  const tgt = nearestTargetPos(g, dx, dy, st.range)
  if (!tgt) { w.cdLeft = 0.08; return }
  w.cdLeft = st.cooldown
  spawnVolley(g, p, w, st, dx, dy, tgt.x, tgt.y)
}

function spawnVolley(g: Game, p: SPlayer, w: OwnedWeapon, st: WeaponStats, fx: number, fy: number, tx: number, ty: number): void {
  const n = Math.max(1, Math.round(st.projectileCount))
  g.ev({ t: 'shoot', id: p.id, w: w.data.id, x: Math.round(fx), y: Math.round(fy), tx: Math.round(tx), ty: Math.round(ty), n })
  const [nx, ny] = norm(tx - fx, ty - fy)
  const baseAng = Math.atan2(ny, nx)
  const spread = n > 1 ? 0.16 : 0
  for (let k = 0; k < n; k++) {
    const ang = baseAng + (k - (n - 1) / 2) * spread
    const { dmg, crit } = rollDamage(g, p, st.damage, w.data.critModifier ?? 1)
    const proj: SProjectile = {
      x: fx, y: fy,
      vx: Math.cos(ang) * (st.speed ?? 480), vy: Math.sin(ang) * (st.speed ?? 480),
      damage: dmg, pierce: st.pierce, knockback: st.knockback,
      left: st.range * 1.25, ownerId: p.id, weaponId: w.data.id, crit,
      explodeRadius: w.data.specialEffect === 'explode' ? (st.radius ?? 0) : 0,
      slow: st.slow ?? 0, slowDur: st.duration ?? 2,
      freezeChance: st.freezeChance ?? 0,
      hitSet: new Set(),
    }
    g.projectiles.push(proj)
  }
}

function tickOrbit(g: Game, p: SPlayer, w: OwnedWeapon, st: WeaponStats, dt: number): void {
  const blades = Math.max(1, Math.round(st.projectileCount))
  w.orbitAngle += dt * (st.speed ?? 3)
  const now = g.time
  for (let k = 0; k < blades; k++) {
    const ang = w.orbitAngle + (k / blades) * Math.PI * 2
    const bx = p.x + Math.cos(ang) * (st.radius ?? 90)
    const by = p.y + Math.sin(ang) * (st.radius ?? 90)
    for (const e of g.enemies) {
      if (e.hp <= 0) continue
      if (dist2(bx, by, e.x, e.y) > (34 + e.radius) ** 2) continue
      const last = w.hitMemo.get(e.i) ?? -99
      if (now - last < st.cooldown) continue
      w.hitMemo.set(e.i, now)
      const { dmg, crit } = rollDamage(g, p, st.damage)
      const [kx, ky] = norm(e.x - p.x, e.y - p.y)
      damageEnemyImpl(g, e, dmg * meleeMult(p), { ownerId: p.id, crit, knockX: kx * st.knockback, knockY: ky * st.knockback, srcX: p.x, srcY: p.y })
    }
  }
  // 環繞刀刃拆箱（memo key 用 objective 的全域唯一 id，不會撞怪物 id）
  for (const o of destructibles(g)) {
    for (let k = 0; k < blades; k++) {
      const ang = w.orbitAngle + (k / blades) * Math.PI * 2
      const bx = p.x + Math.cos(ang) * (st.radius ?? 90)
      const by = p.y + Math.sin(ang) * (st.radius ?? 90)
      if (dist2(bx, by, o.x, o.y) > (34 + o.r) ** 2) continue
      const last = w.hitMemo.get(o.i) ?? -99
      if (now - last < st.cooldown) break
      w.hitMemo.set(o.i, now)
      g.damageObjective(o, st.damage * p.stats.damage)
      break
    }
  }
  // 環繞刀刃打 Boss（memo key -1）
  if (g.boss) {
    for (let k = 0; k < blades; k++) {
      const ang = w.orbitAngle + (k / blades) * Math.PI * 2
      const bx = p.x + Math.cos(ang) * (st.radius ?? 90)
      const by = p.y + Math.sin(ang) * (st.radius ?? 90)
      if (!tryHitBoss(g, bx, by, 34)) continue
      const last = w.hitMemo.get(-1) ?? -99
      if (now - last < st.cooldown) break
      w.hitMemo.set(-1, now)
      const { dmg } = rollDamage(g, p, st.damage)
      damageBoss(g, dmg * meleeMult(p), p.id, p.x, p.y)
      break
    }
  }
  if (w.hitMemo.size > 200) w.hitMemo.clear()
}

const meleeMult = (p: SPlayer) => p.char.passive.effect === 'meleeBoostRescueShield' ? 1.2 : 1

function fireMelee(g: Game, p: SPlayer, w: OwnedWeapon, st: WeaponStats): void {
  if (w.cdLeft > 0) return
  const r = st.radius ?? 110
  const tgt = nearestTargetPos(g, p.x, p.y, r)
  if (!tgt) { w.cdLeft = 0.08; return }
  w.cdLeft = st.cooldown
  g.ev({ t: 'aoe', x: Math.round(p.x), y: Math.round(p.y), r, kind: 'swing', w: w.data.id, id: p.id })
  for (const e of g.enemies) {
    if (e.hp <= 0 || dist2(p.x, p.y, e.x, e.y) > (r + e.radius) ** 2) continue
    const { dmg, crit } = rollDamage(g, p, st.damage)
    const [kx, ky] = norm(e.x - p.x, e.y - p.y)
    damageEnemyImpl(g, e, dmg * meleeMult(p), { ownerId: p.id, crit, knockX: kx * st.knockback, knockY: ky * st.knockback, srcX: p.x, srcY: p.y })
  }
  if (tryHitBoss(g, p.x, p.y, r)) {
    const { dmg } = rollDamage(g, p, st.damage)
    damageBoss(g, dmg * meleeMult(p), p.id, p.x, p.y)
  }
  // 近戰掄擊也拆箱
  for (const o of destructibles(g)) {
    if (dist2(p.x, p.y, o.x, o.y) <= (r + o.r) ** 2) g.damageObjective(o, st.damage * p.stats.damage)
  }
}

function fireChain(g: Game, p: SPlayer, w: OwnedWeapon, st: WeaponStats): void {
  if (w.cdLeft > 0) return
  const first = nearestEnemy(g, p.x, p.y, st.range)
  if (!first) {
    // 沒有小怪時直接電 Boss
    if (g.boss && tryHitBoss(g, p.x, p.y, st.range)) {
      w.cdLeft = st.cooldown
      const { dmg } = rollDamage(g, p, st.damage)
      g.ev({ t: 'aoe', x: Math.round(g.boss.x), y: Math.round(g.boss.y), r: 40, kind: 'lightning' })
      damageBoss(g, dmg, p.id, p.x, p.y)
      return
    }
    w.cdLeft = 0.08
    return
  }
  w.cdLeft = st.cooldown
  const hit = new Set<number>()
  let cur = first.e
  let cx = p.x, cy = p.y
  for (let k = 0; k <= (st.chains ?? 3); k++) {
    hit.add(cur.i)
    g.ev({ t: 'aoe', x: Math.round(cur.x), y: Math.round(cur.y), r: 40, kind: 'lightning' })
    const { dmg, crit } = rollDamage(g, p, st.damage)
    damageEnemyImpl(g, cur, dmg, { ownerId: p.id, crit, srcX: cx, srcY: cy })
    cx = cur.x; cy = cur.y
    // 下一跳
    let next = null as typeof cur | null
    let bd = (st.radius ?? 160) ** 2
    for (const e of g.enemies) {
      if (e.hp <= 0 || hit.has(e.i)) continue
      const d2 = dist2(cx, cy, e.x, e.y)
      if (d2 < bd) { bd = d2; next = e }
    }
    if (!next) break
    cur = next
  }
}

function fireMine(g: Game, p: SPlayer, w: OwnedWeapon, st: WeaponStats): void {
  if (w.cdLeft > 0) return
  w.cdLeft = st.cooldown
  const ang = g.rng() * Math.PI * 2
  const d = 30 + g.rng() * (st.range ?? 90)
  const m = {
    x: p.x + Math.cos(ang) * d, y: p.y + Math.sin(ang) * d,
    radius: st.radius ?? 100, damage: st.damage,
    until: g.time + (st.duration ?? 12), armAt: g.time + 0.5,
    ownerId: p.id, weaponId: w.data.id,
  }
  clampArena(m, 20)
  g.mines.push(m)
  g.ev({ t: 'aoe', x: Math.round(m.x), y: Math.round(m.y), r: 14, kind: 'mine' })
}

function fireTurret(g: Game, p: SPlayer, w: OwnedWeapon, st: WeaponStats): void {
  if (w.cdLeft > 0) return
  const mine = g.turrets.filter(t => t.ownerId === p.id)
  if (mine.length >= 2) { w.cdLeft = 0.5; return }
  w.cdLeft = st.cooldown
  g.turrets.push({
    x: p.x + (g.rng() - 0.5) * 80, y: p.y + (g.rng() - 0.5) * 80,
    damage: st.damage, range: st.range, fireCd: 0.55, cdLeft: 0,
    until: g.time + (st.duration ?? 8), ownerId: p.id,
    guard: eff(p, 'turretGuard') > 0,
  })
  g.ev({ t: 'aoe', x: Math.round(p.x), y: Math.round(p.y), r: 20, kind: 'deploy' })
}

function fireHeal(g: Game, p: SPlayer, w: OwnedWeapon, st: WeaponStats): void {
  if (w.cdLeft > 0) return
  w.cdLeft = st.cooldown
  const heal = st.heal ?? 8
  // 治療：自己 + 範圍內最傷的隊友
  const hurt = [...g.players.values()]
    .filter(q => q.status === 'alive' && q.hp < q.stats.maxHp && (q === p || dist2(p.x, p.y, q.x, q.y) < st.range ** 2))
    .sort((a, b) => a.hp / a.stats.maxHp - b.hp / b.stats.maxHp)
  const targets = hurt.slice(0, 2 + eff(p, 'healSpread'))
  for (const q of targets) {
    healPlayer(g, q, heal)
    g.ev({ t: 'aoe', x: Math.round(q.x), y: Math.round(q.y), r: 40, kind: 'heal' })
  }
  // 光療波：治療脈衝同時灼傷醫生周圍的敵人（讓純補師單人也有輸出、不破壞群體定位）
  const novaR = 150
  let hitAny = false
  for (const e of g.enemies) {
    if (e.hp <= 0) continue
    if (dist2(e.x, e.y, p.x, p.y) > novaR * novaR) continue
    const { dmg, crit } = rollDamage(g, p, heal * 0.6)
    damageEnemyImpl(g, e, dmg, { ownerId: p.id, crit, srcX: p.x, srcY: p.y })
    hitAny = true
  }
  // 沒人受傷也沒打到怪 → 縮短冷卻，讓下一次脈衝更快
  if (!targets.length && !hitAny) w.cdLeft = Math.min(w.cdLeft, 0.6)
  else g.ev({ t: 'aoe', x: Math.round(p.x), y: Math.round(p.y), r: novaR, kind: 'heal' })
}

function fireZone(g: Game, p: SPlayer, w: OwnedWeapon, st: WeaponStats): void {
  if (w.cdLeft > 0) return
  const tgt = nearestEnemy(g, p.x, p.y, st.range)
  if (!tgt) { w.cdLeft = 0.08; return }
  w.cdLeft = st.cooldown
  const { dmg } = rollDamage(g, p, st.burn ?? 6)
  g.zones.push({
    x: tgt.e.x, y: tgt.e.y, radius: st.radius ?? 110,
    dps: dmg, hps: 0, until: g.time + (st.duration ?? 4),
    ownerId: p.id, kind: 'poison', hostile: false, tick: 0,
  })
  g.ev({ t: 'aoe', x: Math.round(tgt.e.x), y: Math.round(tgt.e.y), r: st.radius ?? 110, kind: 'poison' })
}

// -------------------------------------------------------- 投射物 / 地雷 / 砲塔 / 區域

function projectilesTick(g: Game, dt: number): void {
  for (const pr of g.projectiles) {
    pr.x += pr.vx * dt
    pr.y += pr.vy * dt
    pr.left -= Math.hypot(pr.vx, pr.vy) * dt
    if (pr.left <= 0) continue
    for (const e of g.enemies) {
      if (e.hp <= 0 || pr.hitSet.has(e.i)) continue
      if (dist2(pr.x, pr.y, e.x, e.y) > (e.radius + 10) ** 2) continue
      pr.hitSet.add(e.i)
      const [kx, ky] = norm(pr.vx, pr.vy)
      if (pr.explodeRadius > 0) {
        g.ev({ t: 'aoe', x: Math.round(pr.x), y: Math.round(pr.y), r: pr.explodeRadius, kind: 'explosion' })
        for (const o of g.enemies) {
          if (o.hp <= 0 || dist2(o.x, o.y, pr.x, pr.y) > (pr.explodeRadius + o.radius) ** 2) continue
          damageEnemyImpl(g, o, pr.damage, { ownerId: pr.ownerId, crit: pr.crit, knockX: kx * pr.knockback, knockY: ky * pr.knockback, srcX: pr.x, srcY: pr.y })
        }
        pr.left = 0
        break
      }
      damageEnemyImpl(g, e, pr.damage, { ownerId: pr.ownerId, crit: pr.crit, knockX: kx * pr.knockback, knockY: ky * pr.knockback, srcX: pr.x, srcY: pr.y })
      if (pr.slow > 0) { e.slowUntil = g.time + pr.slowDur; e.slowPct = Math.max(e.slowPct, pr.slow) }
      // 菁英不被冰凍定身（改為重度緩速），才「被打不會停止」
      if (pr.freezeChance > 0 && g.rng() < pr.freezeChance) {
        if (e.elite) { e.slowUntil = g.time + 1.2; e.slowPct = Math.max(e.slowPct, 0.5) }
        else e.frozenUntil = g.time + 1.2
      }
      // 冰法被動：所有攻擊 12% 機率減速
      const owner = g.players.get(pr.ownerId)
      if (owner?.char.passive.effect === 'chillTouch' && g.rng() < 0.12) {
        e.slowUntil = g.time + 1.5; e.slowPct = Math.max(e.slowPct, 0.3)
      }
      // 迷幻大麻被動：孢子沾染 — 攻擊 15% 機率使敵人短暫混亂（菁英減半）
      if (owner?.char.passive.effect === 'hazeTouch' && g.rng() < 0.15) {
        e.confusedUntil = Math.max(e.confusedUntil, g.time + (e.elite ? 1 : 2))
      }
      pr.pierce--
      if (pr.pierce < 0) { pr.left = 0; break }
    }
    // 打 Boss
    if (pr.left > 0 && tryHitBoss(g, pr.x, pr.y, 10)) {
      if (pr.explodeRadius > 0) g.ev({ t: 'aoe', x: Math.round(pr.x), y: Math.round(pr.y), r: pr.explodeRadius, kind: 'explosion' })
      damageBoss(g, pr.damage, pr.ownerId, pr.x, pr.y)
      pr.left = 0
    }
    // 打可破壞地圖物件
    if (pr.left > 0) {
      for (const o of g.objectives) {
        if ((o.t !== 'prop' && o.t !== 'nest' && o.t !== 'pillar') || o.s === 2 || o.hp <= 0) continue
        if (dist2(pr.x, pr.y, o.x, o.y) > (o.r + 8) ** 2) continue
        g.damageObjective(o, pr.damage)
        pr.left = 0
        break
      }
    }
  }
  g.projectiles = g.projectiles.filter(p => p.left > 0)
}

function minesTick(g: Game, dt: number): void {
  for (const m of g.mines) {
    if (g.time < m.armAt) continue
    if (g.time > m.until) { m.until = -1; continue }
    // Boss 踩雷
    if (tryHitBoss(g, m.x, m.y, 20)) {
      g.ev({ t: 'aoe', x: Math.round(m.x), y: Math.round(m.y), r: m.radius, kind: 'explosion' })
      damageBoss(g, m.damage, m.ownerId, m.x, m.y)
      m.until = -1
      continue
    }
    for (const e of g.enemies) {
      if (e.hp <= 0 || dist2(m.x, m.y, e.x, e.y) > (e.radius + 20) ** 2) continue
      g.ev({ t: 'aoe', x: Math.round(m.x), y: Math.round(m.y), r: m.radius, kind: 'explosion' })
      const p = g.players.get(m.ownerId)
      for (const o of g.enemies) {
        if (o.hp <= 0 || dist2(o.x, o.y, m.x, m.y) > (m.radius + o.radius) ** 2) continue
        const { dmg, crit } = p ? rollDamage(g, p, m.damage) : { dmg: m.damage, crit: false }
        const [kx, ky] = norm(o.x - m.x, o.y - m.y)
        damageEnemyImpl(g, o, dmg, { ownerId: m.ownerId, crit, knockX: kx * 120, knockY: ky * 120, srcX: m.x, srcY: m.y })
      }
      m.until = -1
      break
    }
  }
  g.mines = g.mines.filter(m => m.until > 0)
}

function turretsTick(g: Game, dt: number): void {
  for (const t of g.turrets) {
    t.cdLeft -= dt
    if (t.cdLeft > 0) continue
    // 哨戒協議：優先打離隊友最近的怪
    let target = null as typeof g.enemies[number] | null
    let bd = t.range * t.range
    for (const e of g.enemies) {
      if (e.hp <= 0) continue
      const d2 = dist2(t.x, t.y, e.x, e.y)
      if (d2 > t.range * t.range) continue
      let score = d2
      if (t.guard) {
        for (const p of g.players.values()) {
          if (p.status !== 'alive') continue
          score = Math.min(score, dist2(e.x, e.y, p.x, p.y))
        }
      }
      if (score < bd || !target) { bd = score; target = e }
    }
    if (!target) {
      // 沒小怪就打 Boss
      if (g.boss && tryHitBoss(g, t.x, t.y, t.range)) {
        t.cdLeft = t.fireCd
        g.ev({ t: 'shoot', id: `turret:${t.ownerId}`, w: 'turret_gun', x: Math.round(t.x), y: Math.round(t.y), tx: Math.round(g.boss.x), ty: Math.round(g.boss.y), n: 1 })
        const p0 = g.players.get(t.ownerId)
        const r0 = p0 ? rollDamage(g, p0, t.damage) : { dmg: t.damage, crit: false }
        damageBoss(g, r0.dmg, t.ownerId, t.x, t.y)
        continue
      }
      t.cdLeft = 0.2
      continue
    }
    t.cdLeft = t.fireCd
    g.ev({ t: 'shoot', id: `turret:${t.ownerId}`, w: 'turret_gun', x: Math.round(t.x), y: Math.round(t.y), tx: Math.round(target.x), ty: Math.round(target.y), n: 1 })
    const p = g.players.get(t.ownerId)
    const { dmg, crit } = p ? rollDamage(g, p, t.damage) : { dmg: t.damage, crit: false }
    damageEnemyImpl(g, target, dmg, { ownerId: t.ownerId, crit, srcX: t.x, srcY: t.y })
  }
  g.turrets = g.turrets.filter(t => g.time < t.until)
}

function zonesTick(g: Game, dt: number): void {
  for (const z of g.zones) {
    z.tick -= dt
    if (z.tick > 0) continue
    z.tick = 0.5
    if (z.hostile) {
      for (const p of g.players.values()) {
        if (p.status === 'alive' && dist2(p.x, p.y, z.x, z.y) < z.radius * z.radius) {
          if (z.dps > 0) g.damagePlayer(p, z.dps * 0.5, { noKnockdownBelow: 1 })
          if (z.hps > 0) healPlayer(g, p, z.hps * 0.5)
        }
      }
    } else if (z.kind === 'haze') {
      // 迷幻孢子雲：不傷害，持續讓踏入的怪物混亂
      for (const e of g.enemies) {
        if (e.hp <= 0 || dist2(e.x, e.y, z.x, z.y) > (z.radius + e.radius) ** 2) continue
        e.confusedUntil = Math.max(e.confusedUntil, g.time + (e.elite ? 0.5 : 1))
      }
    } else {
      if (z.hps > 0) {
        for (const p of g.players.values()) {
          if (p.status === 'alive' && dist2(p.x, p.y, z.x, z.y) < z.radius * z.radius) healPlayer(g, p, z.hps * 0.5)
        }
      }
      if (z.dps > 0) {
        for (const e of g.enemies) {
          if (e.hp <= 0 || dist2(e.x, e.y, z.x, z.y) > (z.radius + e.radius) ** 2) continue
          e.burnDps = Math.max(e.burnDps, z.dps)
          e.burnUntil = Math.max(e.burnUntil, g.time + 1)
        }
      }
    }
  }
  g.zones = g.zones.filter(z => g.time < z.until)
}

// -------------------------------------------------------- 敵方彈幕

export function enemyProjsTick(g: Game, dt: number): void {
  for (const pr of g.enemyProjs) {
    pr.x += pr.vx * dt
    pr.y += pr.vy * dt
    pr.left -= Math.hypot(pr.vx, pr.vy) * dt
    if (pr.left <= 0) continue
    for (const p of g.players.values()) {
      if (p.status !== 'alive') continue
      if (dist2(pr.x, pr.y, p.x, p.y) < 26 * 26) {
        g.damagePlayer(p, pr.damage)
        pr.left = 0
        break
      }
    }
  }
  g.enemyProjs = g.enemyProjs.filter(p => p.left > 0)
}
