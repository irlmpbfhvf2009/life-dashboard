// 玩家武器行為模擬：9 種 behavior + 武器專屬 mech hook。加武器基本只加資料；
// 加機制 = 在這裡（或 enemies.ts 的擊殺類）寫一次 hook。
// 命中結果全部在 server 判定；client 只畫視覺投射物。
import { weaponStatsAt } from '../../../shared/content/index'
import { ARENA } from '../../../shared/balance'
import type { WeaponStats } from '../../../shared/types'
import type { SPlayer, OwnedWeapon, SProjectile, SEnemy } from './state'
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
      let cdTick = dt * atkSpd
      // frenzyKill：擊殺後短暫狂熱攻速（飛刀）
      if (w.frenzyUntil > g.time) cdTick *= 1 + (w.data.mech?.params?.atk ?? 0.5)
      w.cdLeft -= cdTick
      // spinUp：停火時熱度慢慢冷卻（加特林）
      if (w.data.mech?.id === 'spinUp' && w.heat > 0) w.heat = Math.max(0, w.heat - dt * 0.2)
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
  // ── build 擴充軸：固定攻擊力（加在武器基礎）→ 分類傷害% → 召喚物傷害% → 持續傷害%
  st.damage += p.stats.flatDamage
  st.damage *= 1 + categoryDamageOf(p, w.data.category)
  if (w.data.behavior === 'turret' || w.data.behavior === 'drone' || w.data.behavior === 'mine' || w.data.category === 'summon') {
    st.damage *= 1 + p.stats.minionDamage
  }
  if (st.burn) st.burn *= 1 + p.stats.dotDamage
  // 開局收斂：基礎半徑/射程略小 → 「範圍效果」升級近戰遠程都有感、值得選
  if (st.radius) st.radius *= 0.85
  st.range *= 0.9
  // 範圍加成：半徑全吃 area；射程吃一半（遠程 build 也想要範圍效果）
  if (st.radius) st.radius *= p.stats.area
  st.range *= 1 + (p.stats.area - 1) * 0.5
  // 投射物加成
  st.projectileCount += p.stats.projectiles
  st.pierce += p.stats.pierce
  // spinUp：熱度提高攻速（縮短冷卻）
  if (w.data.mech?.id === 'spinUp' && w.heat > 0) st.cooldown /= 1 + w.heat
  return st
}

/** 分類傷害%：依武器 category 取對應加成（support/summon 只吃通用傷害%） */
function categoryDamageOf(p: SPlayer, cat: string): number {
  return cat === 'melee' ? p.stats.meleeDamage
    : cat === 'ranged' ? p.stats.rangedDamage
    : cat === 'magic' ? p.stats.magicDamage
    : cat === 'engineer' ? p.stats.engineerDamage
    : 0
}

/** 傷害合成（含站位合作加成/暴擊）；forceCrit = critEvery 之類的必暴機制 */
export function rollDamage(g: Game, p: SPlayer, base: number, critMod = 1, forceCrit = false): { dmg: number; crit: boolean } {
  let mult = p.stats.damage
  if (eff(p, 'nearAllyDamage')) {
    for (const q of g.players.values()) {
      if (q !== p && q.status === 'alive' && dist2(p.x, p.y, q.x, q.y) < 160 * 160) {
        mult *= 1 + 0.1 * eff(p, 'nearAllyDamage')
        break
      }
    }
  }
  // 力場護盾：目前護盾越滿，傷害越高（最多 +50%）
  if (eff(p, 'shieldToDamage') && p.shield > 0) {
    mult *= 1 + Math.min(0.5, p.shield / Math.max(1, p.stats.maxHp) * 0.5)
  }
  // 暴擊率 = 屬性 + 暫時 buff（賭徒幸運爆發等）
  const critCh = p.stats.critChance + (p.buffs.critUntil > g.time ? p.buffs.critAmt : 0)
  const crit = forceCrit || g.rng() < critCh * critMod
  if (crit) {
    // 暴擊率超過 100%（含臨時 buff）→ 溢出部分 1:1 再轉暴擊傷害（屬性溢出已在 stats 併入）
    mult *= p.stats.critDamage + Math.max(0, critCh - 1)
  } else if (eff(p, 'curseEdge')) mult *= 0.8
  return { dmg: base * mult, crit }
}

// -------------------------------------------------------- 武器 mech hook

/** 命中前傷害倍率類 mech（依目標狀態）：處決 / 碎殼重壓 / 一之太刀 */
function enemyMechMult(mechId: string | undefined, prm: Record<string, number>, e: SEnemy): number {
  if (mechId === 'execute' && e.hp / e.maxHp < (prm.below ?? 0.3)) return prm.mult ?? 2
  if (mechId === 'bossKiller' && e.elite) return prm.mult ?? 1.5
  if (mechId === 'firstStrike' && e.hp >= e.maxHp) return prm.mult ?? 1.6
  return 1
}

/** 命中後效果類 mech：標記/流血點燃/混亂/暈眩/吸血/荊棘護盾/孢子雲/分裂 */
function onHitMech(
  g: Game, ownerId: string, weaponId: string,
  mechId: string | undefined, prm: Record<string, number>,
  e: SEnemy, dealt: number, crit: boolean,
): void {
  if (!mechId) return
  const p = g.players.get(ownerId)
  if (!p) return
  switch (mechId) {
    case 'markHit':
      if (e.hp > 0) { e.markedUntil = g.time + (prm.dur ?? 3); e.markMult = Math.max(e.markMult, prm.mult ?? 1.15) }
      break
    case 'dotHit':
      if (e.hp > 0) {
        e.burnDps = Math.max(e.burnDps, dealt * (prm.pct ?? 0.3) * (1 + p.stats.dotDamage))
        e.burnUntil = Math.max(e.burnUntil, g.time + (prm.dur ?? 3))
      }
      break
    case 'confuseHit':
      if (e.hp > 0 && g.rng() < (prm.chance ?? 0.2)) {
        e.confusedUntil = Math.max(e.confusedUntil, g.time + (e.elite ? (prm.dur ?? 1.5) / 2 : (prm.dur ?? 1.5)))
      }
      break
    case 'stunHit':
      if (e.hp > 0 && g.rng() < (prm.chance ?? 0.3)) {
        if (e.elite) { e.slowUntil = g.time + (prm.dur ?? 0.6); e.slowPct = Math.max(e.slowPct, 0.5) }
        else e.frozenUntil = g.time + (prm.dur ?? 0.6)
      }
      break
    case 'lifesteal':
      if (dealt > 0) healPlayer(g, p, dealt * (prm.pct ?? 0.12))
      break
    case 'thornShield':
      if (p.shield < (prm.cap ?? 20)) p.shield = Math.min(prm.cap ?? 20, p.shield + (prm.amount ?? 0.5))
      break
    case 'sporeCloud':
      if (g.rng() < (prm.chance ?? 0.25)) {
        g.zones.push({ x: e.x, y: e.y, radius: prm.radius ?? 75, dps: 0, hps: 0, until: g.time + (prm.dur ?? 1.5), ownerId, kind: 'haze', hostile: false, tick: 0 })
        g.ev({ t: 'aoe', x: Math.round(e.x), y: Math.round(e.y), r: prm.radius ?? 75, kind: 'haze' })
      }
      break
    case 'splitOnHit':
      if (g.rng() < (prm.chance ?? 0.3)) spawnSplinters(g, ownerId, weaponId, e.x, e.y, prm.count ?? 2, dealt * (prm.pct ?? 0.5), e.i)
      break
    case 'splitOnCrit':
      if (crit) spawnSplinters(g, ownerId, weaponId, e.x, e.y, prm.count ?? 2, dealt * (prm.pct ?? 0.5), e.i)
      break
  }
}

/** 分裂小彈（splitOnHit / splitOnCrit；不繼承 mech → 不會連鎖分裂） */
function spawnSplinters(g: Game, ownerId: string, weaponId: string, x: number, y: number, count: number, dmg: number, excludeIdx: number): void {
  const baseAng = g.rng() * Math.PI * 2
  for (let k = 0; k < count; k++) {
    const ang = baseAng + (k / count) * Math.PI * 2
    g.projectiles.push({
      x, y, vx: Math.cos(ang) * 440, vy: Math.sin(ang) * 440,
      damage: Math.max(1, dmg), pierce: 0, knockback: 15,
      left: 170, initLeft: 170, ownerId, weaponId, crit: false,
      explodeRadius: 0, slow: 0, slowDur: 0, freezeChance: 0,
      hitSet: new Set([excludeIdx]), bounces: 0, jumps: 0,
    })
  }
  g.ev({ t: 'shoot', id: ownerId, w: weaponId, x: Math.round(x), y: Math.round(y), tx: Math.round(x), ty: Math.round(y - 10), n: count })
}

function nearestEnemy(g: Game, x: number, y: number, range: number): { e: typeof g.enemies[number]; d2: number } | null {
  let best = null as { e: typeof g.enemies[number]; d2: number } | null
  const r2 = range * range
  for (const e of g.enemies) {
    if (e.hp <= 0 || e.cloaked) continue      // 隱形怪：自動瞄準鎖不到（範圍波及仍會打到並使其現形）
    const d2 = dist2(x, y, e.x, e.y)
    if (d2 < r2 && (!best || d2 < best.d2)) best = { e, d2 }
  }
  return best
}

/** ricochet 用：最近的「還沒被這顆子彈打過」的敵人 */
function nearestEnemyExcluding(g: Game, x: number, y: number, range: number, exclude: Set<number>): SEnemy | null {
  let best: SEnemy | null = null
  let bd = range * range
  for (const e of g.enemies) {
    if (e.hp <= 0 || e.cloaked || exclude.has(e.i)) continue
    const d2 = dist2(x, y, e.x, e.y)
    if (d2 < bd) { bd = d2; best = e }
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
  const mech = w.data.mech
  const prm = mech?.params ?? {}
  // volley 級 mech：骰子傷害 / 每第 N 發必暴 / 加特林熱度
  let volleyMult = 1
  let forceCrit = false
  if (mech?.id === 'diceDamage') volleyMult = (prm.min ?? 0.4) + g.rng() * ((prm.max ?? 2.5) - (prm.min ?? 0.4))
  if (mech?.id === 'critEvery') { w.counter++; if (w.counter % (prm.n ?? 5) === 0) forceCrit = true }
  if (mech?.id === 'spinUp') w.heat = Math.min(prm.max ?? 0.6, w.heat + (prm.ramp ?? 0.05))
  const [nx, ny] = norm(tx - fx, ty - fy)
  const baseAng = Math.atan2(ny, nx)
  const spread = n > 1 ? 0.16 : 0
  for (let k = 0; k < n; k++) {
    const ang = baseAng + (k - (n - 1) / 2) * spread
    const { dmg, crit } = rollDamage(g, p, st.damage * volleyMult, w.data.critModifier ?? 1, forceCrit)
    const proj: SProjectile = {
      x: fx, y: fy,
      vx: Math.cos(ang) * (st.speed ?? 480), vy: Math.sin(ang) * (st.speed ?? 480),
      damage: dmg, pierce: st.pierce, knockback: st.knockback,
      left: st.range * 1.25, initLeft: st.range * 1.25,
      ownerId: p.id, weaponId: w.data.id, crit,
      explodeRadius: w.data.specialEffect === 'explode' ? (st.radius ?? 0) : 0,
      slow: st.slow ?? 0, slowDur: st.duration ?? 2,
      freezeChance: st.freezeChance ?? 0,
      hitSet: new Set(),
      mechId: mech?.id, mechP: mech?.params,
      bounces: mech?.id === 'wallBounce' ? (prm.bounces ?? 2) : 0,
      jumps: mech?.id === 'ricochet' ? (prm.jumps ?? 2) : 0,
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
      const { dmg, crit } = rollDamage(g, p, st.damage, w.data.critModifier ?? 1)
      const [kx, ky] = norm(e.x - p.x, e.y - p.y)
      const dealt = damageEnemyImpl(g, e, dmg * meleeMult(p), { ownerId: p.id, crit, knockX: kx * st.knockback, knockY: ky * st.knockback, srcX: p.x, srcY: p.y, weaponId: w.data.id })
      onHitMech(g, p.id, w.data.id, w.data.mech?.id, w.data.mech?.params ?? {}, e, dealt, crit)
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
  let r = st.radius ?? 110
  const tgt = nearestTargetPos(g, p.x, p.y, r)
  if (!tgt) { w.cdLeft = 0.08; return }
  w.cdLeft = st.cooldown
  const mech = w.data.mech
  const prm = mech?.params ?? {}
  let swingMult = 1
  // comboNova：每第 N 擊蓄力橫掃（範圍/傷害放大）
  if (mech?.id === 'comboNova') {
    w.counter++
    if (w.counter % (prm.every ?? 3) === 0) { r *= prm.radiusMult ?? 1.6; swingMult *= prm.dmgMult ?? 1.5 }
  }
  const hits = g.enemies.filter(e => e.hp > 0 && dist2(p.x, p.y, e.x, e.y) <= (r + e.radius) ** 2)
  // crowdBonus：掃到越多越痛
  if (mech?.id === 'crowdBonus' && hits.length > 1) {
    swingMult *= 1 + Math.min(prm.cap ?? 0.8, (prm.per ?? 0.08) * (hits.length - 1))
  }
  g.ev({ t: 'aoe', x: Math.round(p.x), y: Math.round(p.y), r, kind: 'swing', w: w.data.id, id: p.id })
  for (const e of hits) {
    if (e.hp <= 0) continue
    const { dmg, crit } = rollDamage(g, p, st.damage * swingMult)
    const [kx, ky] = norm(e.x - p.x, e.y - p.y)
    const dealt = damageEnemyImpl(g, e, dmg * meleeMult(p) * enemyMechMult(mech?.id, prm, e), {
      ownerId: p.id, crit, knockX: kx * st.knockback, knockY: ky * st.knockback, srcX: p.x, srcY: p.y, weaponId: w.data.id,
    })
    onHitMech(g, p.id, w.data.id, mech?.id, prm, e, dealt, crit)
  }
  if (tryHitBoss(g, p.x, p.y, r)) {
    const { dmg } = rollDamage(g, p, st.damage * swingMult)
    const bossMult = mech?.id === 'bossKiller' ? (prm.mult ?? 1.5) : 1
    damageBoss(g, dmg * meleeMult(p) * bossMult, p.id, p.x, p.y)
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
  const mech = w.data.mech
  const prm = mech?.params ?? {}
  // zone 四把四種玩法：疊毒 / 冰霜凍結 / 雷射遞增 / 地刺脈衝
  const kind = mech?.id === 'frostZone' ? 'frost' as const
    : mech?.id === 'rampZone' ? 'fire' as const
    : mech?.id === 'pulseZone' ? 'spike' as const
    : 'poison' as const
  g.zones.push({
    x: tgt.e.x, y: tgt.e.y, radius: st.radius ?? 110,
    dps: dmg, hps: 0, until: g.time + (st.duration ?? 4),
    ownerId: p.id, kind, hostile: false, tick: 0,
    stack: mech?.id === 'stackDot' || undefined,
    slowPct: mech?.id === 'frostZone' ? (prm.slow ?? 0.5) : undefined,
    freeze: mech?.id === 'frostZone' ? (prm.freeze ?? 0.06) : undefined,
    ramp: mech?.id === 'rampZone' ? (prm.per ?? 0.18) : undefined,
    pulseKb: mech?.id === 'pulseZone' ? (prm.kb ?? 180) : undefined,
    born: g.time,
  })
  g.ev({ t: 'aoe', x: Math.round(tgt.e.x), y: Math.round(tgt.e.y), r: st.radius ?? 110, kind })
}

// -------------------------------------------------------- 投射物 / 地雷 / 砲塔 / 區域

function projectilesTick(g: Game, dt: number): void {
  for (const pr of g.projectiles) {
    // homing：朝最近敵人小幅轉向（轉速受 turn 參數限制）
    if (pr.mechId === 'homing') {
      const tgt = nearestEnemy(g, pr.x, pr.y, 260)
      if (tgt) {
        const sp = Math.hypot(pr.vx, pr.vy)
        const cur = Math.atan2(pr.vy, pr.vx)
        const want = Math.atan2(tgt.e.y - pr.y, tgt.e.x - pr.x)
        let diff = want - cur
        while (diff > Math.PI) diff -= Math.PI * 2
        while (diff < -Math.PI) diff += Math.PI * 2
        const maxTurn = (pr.mechP?.turn ?? 5) * dt
        const ang = cur + Math.max(-maxTurn, Math.min(maxTurn, diff))
        pr.vx = Math.cos(ang) * sp; pr.vy = Math.sin(ang) * sp
      }
    }
    pr.x += pr.vx * dt
    pr.y += pr.vy * dt
    pr.left -= Math.hypot(pr.vx, pr.vy) * dt
    if (pr.left <= 0) continue
    // wallBounce：碰場邊反彈
    if (pr.bounces > 0) {
      if ((pr.x < 8 && pr.vx < 0) || (pr.x > ARENA.w - 8 && pr.vx > 0)) { pr.vx = -pr.vx; pr.bounces-- }
      if ((pr.y < 8 && pr.vy < 0) || (pr.y > ARENA.h - 8 && pr.vy > 0)) { pr.vy = -pr.vy; pr.bounces-- }
    }
    for (const e of g.enemies) {
      if (e.hp <= 0 || pr.hitSet.has(e.i)) continue
      if (dist2(pr.x, pr.y, e.x, e.y) > (e.radius + 10) ** 2) continue
      pr.hitSet.add(e.i)
      const [kx, ky] = norm(pr.vx, pr.vy)
      if (pr.explodeRadius > 0) {
        g.ev({ t: 'aoe', x: Math.round(pr.x), y: Math.round(pr.y), r: pr.explodeRadius, kind: 'explosion' })
        for (const o of g.enemies) {
          if (o.hp <= 0 || dist2(o.x, o.y, pr.x, pr.y) > (pr.explodeRadius + o.radius) ** 2) continue
          damageEnemyImpl(g, o, pr.damage, { ownerId: pr.ownerId, crit: pr.crit, knockX: kx * pr.knockback, knockY: ky * pr.knockback, srcX: pr.x, srcY: pr.y, weaponId: pr.weaponId })
        }
        // burnGround：爆炸點留下燃燒區（火球）
        if (pr.mechId === 'burnGround') {
          const prm = pr.mechP ?? {}
          g.zones.push({
            x: pr.x, y: pr.y, radius: pr.explodeRadius * 0.85,
            dps: Math.max(2, pr.damage * (prm.pct ?? 0.35)), hps: 0,
            until: g.time + (prm.dur ?? 2), ownerId: pr.ownerId, kind: 'fire', hostile: false, tick: 0,
          })
        }
        pr.left = 0
        break
      }
      // 飛行距離/穿透數傷害調整：狙擊(越遠越痛) / 霰彈(越近越痛) / 氣功波(每穿一個 +12%)
      let hitDmg = pr.damage
      const mp = pr.mechP ?? {}
      if (pr.mechId === 'rangeRamp' && pr.initLeft > 0) hitDmg *= 1 + (mp.max ?? 1) * Math.min(1, Math.max(0, 1 - pr.left / pr.initLeft))
      if (pr.mechId === 'closeRamp' && pr.initLeft > 0) hitDmg *= 1 + (mp.max ?? 0.8) * Math.max(0, Math.min(1, pr.left / pr.initLeft))
      if (pr.mechId === 'pierceRamp') hitDmg *= 1 + (mp.per ?? 0.12) * Math.max(0, pr.hitSet.size - 1)
      hitDmg *= enemyMechMult(pr.mechId, mp, e)
      const dealt = damageEnemyImpl(g, e, hitDmg, { ownerId: pr.ownerId, crit: pr.crit, knockX: kx * pr.knockback, knockY: ky * pr.knockback, srcX: pr.x, srcY: pr.y, weaponId: pr.weaponId })
      onHitMech(g, pr.ownerId, pr.weaponId, pr.mechId, mp, e, dealt, pr.crit)
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
      if (pr.pierce < 0) {
        // ricochet：穿透耗盡時彈射到最近的未命中敵人（苦無）
        if (pr.jumps > 0) {
          const nxt = nearestEnemyExcluding(g, pr.x, pr.y, 260, pr.hitSet)
          if (nxt) {
            pr.jumps--
            pr.pierce = 0
            const sp = Math.hypot(pr.vx, pr.vy)
            const [dx, dy] = norm(nxt.x - pr.x, nxt.y - pr.y)
            pr.vx = dx * sp; pr.vy = dy * sp
            pr.left = Math.max(pr.left, 320)
            break
          }
        }
        pr.left = 0
        break
      }
    }
    // 打 Boss
    if (pr.left > 0 && tryHitBoss(g, pr.x, pr.y, 10)) {
      if (pr.explodeRadius > 0) g.ev({ t: 'aoe', x: Math.round(pr.x), y: Math.round(pr.y), r: pr.explodeRadius, kind: 'explosion' })
      let bossDmg = pr.damage
      const mp = pr.mechP ?? {}
      if (pr.mechId === 'bossKiller') bossDmg *= mp.mult ?? 1.5
      if (pr.mechId === 'rangeRamp' && pr.initLeft > 0) bossDmg *= 1 + (mp.max ?? 1) * Math.min(1, Math.max(0, 1 - pr.left / pr.initLeft))
      if (pr.mechId === 'closeRamp' && pr.initLeft > 0) bossDmg *= 1 + (mp.max ?? 0.8) * Math.max(0, Math.min(1, pr.left / pr.initLeft))
      if (pr.mechId === 'pierceRamp') bossDmg *= 1 + (mp.per ?? 0.12) * pr.hitSet.size
      damageBoss(g, bossDmg, pr.ownerId, pr.x, pr.y)
      // 吸血對 Boss 也有效
      if (pr.mechId === 'lifesteal') {
        const p = g.players.get(pr.ownerId)
        if (p) healPlayer(g, p, bossDmg * ((mp.pct ?? 0.12)))
      }
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
        damageEnemyImpl(g, o, dmg, { ownerId: m.ownerId, crit, knockX: kx * 120, knockY: ky * 120, srcX: m.x, srcY: m.y, weaponId: m.weaponId })
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
      if (e.hp <= 0 || e.cloaked) continue
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
      if (z.dps > 0 || z.slowPct || z.freeze || z.pulseKb) {
        // rampZone：存在越久 dps 越高（雷射柵欄）
        const rampMult = z.ramp ? 1 + z.ramp * Math.floor((g.time - (z.born ?? g.time)) / 0.5) : 1
        for (const e of g.enemies) {
          if (e.hp <= 0 || dist2(e.x, e.y, z.x, z.y) > (z.radius + e.radius) ** 2) continue
          if (z.dps > 0) {
            if (z.stack) {
              // stackDot：毒素疊加（上限 3 倍）
              e.burnDps = Math.min(e.burnDps + z.dps * 0.35, z.dps * 3)
              e.burnUntil = Math.max(e.burnUntil, g.time + 1.5)
            } else {
              e.burnDps = Math.max(e.burnDps, z.dps * rampMult)
              e.burnUntil = Math.max(e.burnUntil, g.time + 1)
            }
          }
          // frostZone：圈內重度減速 + 機率凍結
          if (z.slowPct) { e.slowUntil = g.time + 0.6; e.slowPct = Math.max(e.slowPct, z.slowPct) }
          if (z.freeze && g.rng() < z.freeze) {
            if (e.elite) { e.slowUntil = g.time + 0.8; e.slowPct = Math.max(e.slowPct, 0.5) }
            else e.frozenUntil = g.time + 0.8
          }
          // pulseZone：每次脈衝把敵人往外彈（地刺柱）
          if (z.pulseKb && !e.elite) {
            const [kx, ky] = norm(e.x - z.x, e.y - z.y)
            const resist = e.data.tier === 3 ? 0.3 : e.data.tier === 2 ? 0.6 : 1
            e.kbVx += kx * z.pulseKb * resist
            e.kbVy += ky * z.pulseKb * resist
          }
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
