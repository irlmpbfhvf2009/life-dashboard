// 睏寶（kunbao）的放置炸彈系統 —— 設計書見 game/DESIGN-kunbao.md
//
// 核心概念：他的六個武器欄不是六把武器，而是「同一顆炸彈的六個模組」。
// buildSpec() 把 6 個模組（各 4 級＝白/藍/紫/紅）合成一份 BombSpec，
// 放彈時把 spec 快照進 SBomb —— 之後升級不影響已在地上的炸彈。
//
// 唯一的指數來源是「連鎖」：爆風掃到另一顆炸彈就引爆它，第 n 段傷害 ×(1+step×(n-1))。
// 段數上限（BOMB.chainCap）與同時炸彈硬上限（BOMB.hardStock）是效能與溢出護欄，不是平衡旋鈕。
import { BOMB, drowsyTier } from '../../../shared/balance'
import type { SPlayer, SBomb, SPillow } from './state'
import type { Game } from './game'
import { dist2, norm, clampArena } from './util'
import { damageEnemyImpl } from './enemies'
import { damageBoss, tryHitBoss } from './boss'
import { eff } from './stats'
import { healPlayer } from './drops'

export const isKunbao = (p: SPlayer) => p.char.passive.effect === 'dreamFuse'

/** 模組等級（0 = 未持有；1~4 = 白/藍/紫/紅） */
const mod = (p: SPlayer, id: string) => p.weapons.find(w => w.data.id === id)?.level ?? 0

export interface BombSpec {
  interval: number        // 放彈間隔（秒）
  fuse: number
  damage: number
  arm: number             // 爆風臂長（px）
  stock: number           // 同時炸彈上限
  crossX: boolean         // 異常核（藍）X 型斜臂
  sub: boolean            // 異常核（紅）子炸彈
  contact: boolean        // 引信（紅）碰到即爆
  impatient: boolean      // 引信（紫）沒人踩就自己燒完
  overload: number        // 火藥（紫）引信剩越久傷害越高
  flameDur: number        // 火焰核（藍+）火痕秒數
  flameIgnite: boolean    // 火焰核（紫）火痕可被爆風再引爆
  flameAmp: boolean       // 火焰核（紅）火痕內敵人受爆炸傷害 +25%
  autoDet: boolean        // 遙控器（白）每 6 秒引爆最舊的一顆
  detAll: boolean         // 遙控器（藍）惡夢枕引爆全場
  deathSync: boolean      // 遙控器（紫）致命傷時引爆身邊炸彈並無敵
  syncBlast: boolean      // 遙控器（紅）全部同時引爆並互相分享傷害
  freeChance: number      // 彈藥箱（藍）放彈不消耗庫存的機率
  waveStart: number       // 彈藥箱（紫）每波開場鋪幾顆
  doubleDrop: boolean     // 彈藥箱（紅）庫存滿時一次放兩顆
}

/** 六模組 → 一顆炸彈的規格。等級效果是累積的（紅階同時擁有白藍紫的效果）。 */
export function buildSpec(g: Game, p: SPlayer): BombSpec {
  const fuseL = mod(p, 'k_fuse'), powderL = mod(p, 'k_powder'), flameL = mod(p, 'k_flame')
  const crateL = mod(p, 'k_crate'), remoteL = mod(p, 'k_remote'), coreL = mod(p, 'k_core')
  const tier = drowsyTier(p.drowsy)

  // ── 放彈間隔：攻速＝放彈頻率；睡意越深放得越快
  let interval = BOMB.baseInterval / Math.max(0.2, p.stats.attackSpeed)
  if (fuseL >= 1) interval *= 0.88
  if (tier === 1) interval *= BOMB.lightInterval
  if (tier === 2) interval *= BOMB.deepInterval
  if (p.buffs.rageUntil > g.time) interval /= 1 + p.buffs.rageAmt
  if (g.time < p.alarmUntil) interval *= 0.5             // 貪睡鬧鐘

  // ── 引信
  let fuse: number = BOMB.baseFuse
  if (fuseL >= 2) fuse -= 0.25
  if (tier >= 1) fuse += BOMB.lightFuse
  fuse -= 0.2 * eff(p, 'kbShortFuse')
  if (eff(p, 'kbParadox')) fuse *= 0.2
  fuse = Math.max(0.25, fuse)

  // ── 傷害（火藥階梯 + 固定攻擊力 + 傷害倍率 + 工程分類傷害）
  const powderAdd = [0, 8, 24, 24, 64][powderL] ?? 0
  let damage = (BOMB.baseDamage + powderAdd + p.stats.flatDamage)
    * p.stats.damage * (1 + p.stats.engineerDamage)
  if (eff(p, 'kbFusion')) damage *= 3
  if (eff(p, 'kbParadox')) damage *= 0.4

  // ── 火力（爆風臂長）
  let power = BOMB.basePower
    + ([0, 1, 2, 2, 4][flameL] ?? 0)
    + eff(p, 'kbPower')
    + eff(p, 'kunMastery')
    + (tier === 2 ? BOMB.deepPower : 0)
    + (eff(p, 'kbFusion') ? 3 : 0)
  power = Math.max(1, power)
  const arm = power * BOMB.cell * (coreL >= 3 ? 1.4 : 1) * p.stats.area

  // ── 庫存
  let stock = BOMB.baseStock + ([0, 1, 2, 4, 6][crateL] ?? 0) + eff(p, 'kbStock')
  if (eff(p, 'kbFusion')) stock -= 3
  stock = Math.max(1, Math.min(BOMB.hardStock, stock))

  return {
    interval: Math.max(0.12, interval), fuse, damage, arm, stock,
    crossX: coreL >= 2, sub: coreL >= 4,
    contact: fuseL >= 4, impatient: fuseL >= 3,
    overload: powderL >= 3 ? 0.5 : 0,
    flameDur: flameL >= 2 ? (flameL >= 4 ? 3 : 1.5) : 0,
    flameIgnite: flameL >= 3, flameAmp: flameL >= 4,
    autoDet: remoteL >= 1, detAll: remoteL >= 2, deathSync: remoteL >= 3, syncBlast: remoteL >= 4,
    freeChance: crateL >= 2 ? 0.15 : 0,
    waveStart: crateL >= 3 ? 3 : 0,
    doubleDrop: crateL >= 4,
  }
}

const chainCap = (p: SPlayer) => (eff(p, 'kbDomino') ? Infinity : BOMB.chainCap + 2 * eff(p, 'kbChainCap'))
const chainStep = (p: SPlayer) => (eff(p, 'kbReactor') ? 0.20 : BOMB.chainStep)

// ---------------------------------------------------------------- 放彈

export function placeBomb(g: Game, p: SPlayer, spec: BombSpec, x: number, y: number, gen = 0, dmgMult = 1, fuseOverride?: number): void {
  if (g.bombs.length >= BOMB.hardStock * 2) return          // 全場硬上限（多人）
  const b: SBomb = {
    i: g.bombSeq++, x, y,
    fuse: fuseOverride ?? spec.fuse, fuseMax: fuseOverride ?? spec.fuse,
    damage: spec.damage * dmgMult,
    arm: gen > 0 ? Math.max(BOMB.cell, spec.arm - 2 * BOMB.cell) : spec.arm,
    ownerId: p.id, gen,
    crossX: spec.crossX, sub: spec.sub && gen === 0,       // 子炸彈不再生子炸彈
    contact: spec.contact, impatient: spec.impatient,
    overload: spec.overload, flameDur: spec.flameDur,
    born: g.time, dead: false,
  }
  clampArena(b, 18)
  g.bombs.push(b)
}

/** 我的炸彈（依放置順序） */
const myBombs = (g: Game, p: SPlayer) => g.bombs.filter(b => b.ownerId === p.id && !b.dead)

// ---------------------------------------------------------------- 每 tick

export function bombsTick(g: Game, dt: number): void {
  pillowsTick(g, dt)

  for (const p of g.players.values()) {
    if (!p.connected || p.status !== 'alive' || !isKunbao(p)) continue
    const spec = buildSpec(g, p)
    const mine = myBombs(g, p)

    // 放彈
    p.bombCd -= dt
    if (p.bombCd <= 0 && mine.length < spec.stock) {
      p.bombCd = spec.interval
      const tier = drowsyTier(p.drowsy)
      let count = 1
      if (tier === 2) count = 2                                       // 熟睡：一次兩顆
      if (spec.doubleDrop && mine.length + count >= spec.stock) count++ // 彈藥箱（紅）
      dropAt(g, p, spec, count)
      if (spec.freeChance && g.rng() < spec.freeChance) p.bombCd = 0   // 彈藥箱（藍）不消耗
    }

    // 夢話：熟睡時額外節拍
    if (eff(p, 'kbSleepTalk') && drowsyTier(p.drowsy) === 2) {
      p.sleepTalkCd -= dt
      if (p.sleepTalkCd <= 0) { p.sleepTalkCd = 2; if (mine.length < spec.stock) dropAt(g, p, spec, 1) }
    }

    // 遙控器（白）：每 6 秒自動引爆最舊的一顆
    if (spec.autoDet) {
      p.remoteCd -= dt
      if (p.remoteCd <= 0) {
        p.remoteCd = 6
        const oldest = mine[0]
        if (oldest) detonate(g, [oldest])
      }
    }

    // 定時同步：所有炸彈引信對齊到最短的那顆
    if (eff(p, 'kbSync') && mine.length > 1) {
      const min = Math.min(...mine.map(b => b.fuse))
      for (const b of mine) b.fuse = min
    }
  }

  // 引信燃燒 + 觸發判定
  const triggered: SBomb[] = []
  for (const b of g.bombs) {
    if (b.dead) continue
    const owner = g.players.get(b.ownerId)
    // 惡夢枕：擁有者的核心在場時，引信燒 3 倍快
    const haste = g.pillows.some(pl => pl.ownerId === b.ownerId) ? 3 : 1
    b.fuse -= dt * haste

    if (owner) {
      const near = nearestEnemyDist2(g, b.x, b.y)
      // 引信（紅）一觸即發 / 踩雷者
      if (b.contact && near < 26 ** 2) b.fuse = 0
      else if (eff(owner, 'kbStepOn') && near < 30 ** 2 && b.fuse > b.fuseMax * 0.5) b.fuse = b.fuseMax * 0.5
      // 引信（紫）不耐煩：落地 1 秒後周圍沒人就自己燒完
      else if (b.impatient && g.time - b.born > 1 && near > 200 ** 2 && b.fuse > 0.4) b.fuse = 0.4
    }
    if (b.fuse <= 0) triggered.push(b)
  }
  if (triggered.length) detonate(g, triggered)
}

function dropAt(g: Game, p: SPlayer, spec: BombSpec, count: number): void {
  for (let k = 0; k < count; k++) {
    const off = k === 0 ? [0, 0] : [(g.rng() - 0.5) * 70, (g.rng() - 0.5) * 70]
    placeBomb(g, p, spec, p.x + off[0], p.y + off[1])
  }
}

function nearestEnemyDist2(g: Game, x: number, y: number): number {
  let best = Infinity
  for (const e of g.enemies) {
    if (e.hp <= 0) continue
    const d = dist2(x, y, e.x, e.y)
    if (d < best) best = d
  }
  return best
}

// ---------------------------------------------------------------- 連鎖引爆

/** 十字（＋可選 X 型）爆風的命中判定 */
function inBlast(b: SBomb, x: number, y: number, pad: number): boolean {
  const dx = x - b.x, dy = y - b.y
  const half = BOMB.armWidth / 2 + pad, len = b.arm + pad
  if ((Math.abs(dx) <= len && Math.abs(dy) <= half) || (Math.abs(dy) <= len && Math.abs(dx) <= half)) return true
  if (!b.crossX) return false
  const s = Math.SQRT1_2
  const u = (dx + dy) * s, v = (dy - dx) * s
  const xl = b.arm * 0.6 + pad
  return (Math.abs(u) <= xl && Math.abs(v) <= half) || (Math.abs(v) <= xl && Math.abs(u) <= half)
}

/**
 * 引爆一組炸彈，並以 BFS 展開整條連鎖（同一個 tick 內處理完，不遞迴）。
 * 第 n 段傷害 ×(1 + step×(n-1))，段數上限 chainCap（骨牌宇宙 = 無限）。
 */
export function detonate(g: Game, seeds: SBomb[]): void {
  if (!seeds.length) return
  const owner = g.players.get(seeds[0].ownerId)
  if (!owner) return

  const spec = buildSpec(g, owner)
  const cap = chainCap(owner), step = chainStep(owner)

  // 遙控器（紅）同步爆破：全部一起炸，並互相分享 15% 傷害
  let syncMult = 1
  const queue: SBomb[] = []
  if (spec.syncBlast) {
    const all = myBombs(g, owner)
    syncMult = Math.min(2.5, 1 + 0.15 * Math.max(0, all.length - 1))
    for (const b of all) { b.dead = true; queue.push(b) }
  } else {
    for (const b of seeds) if (!b.dead) { b.dead = true; queue.push(b) }
  }

  let seg = 0
  let healedAt = 0
  while (queue.length) {
    const b = queue.shift()!
    seg++
    const mult = (1 + step * (Math.min(seg, cap) - 1)) * syncMult
    for (const nb of blast(g, owner, b, mult, spec)) {
      if (nb.dead) continue
      nb.dead = true
      queue.push(nb)
    }
    // 每 5 段回 3% 最大生命
    if (seg - healedAt >= BOMB.chainHealEvery) { healedAt = seg; healPlayer(g, owner, owner.stats.maxHp * BOMB.chainHealPct) }
  }

  g.bombs = g.bombs.filter(b => !b.dead)

  if (seg >= 5) {
    if (eff(owner, 'kbCdBlast')) owner.skillCdLeft = Math.max(0, owner.skillCdLeft - 2)
    if (seg >= 8 && eff(owner, 'kbBreed')) placeBomb(g, owner, spec, owner.x + (g.rng() - 0.5) * 90, owner.y + (g.rng() - 0.5) * 90)
    g.toastTo(owner, `💥 連鎖 ${seg} 段！`, 'good')
  }
}

/** 單顆炸彈的爆風：傷害、擊退、把主人炸飛、火痕、子炸彈；回傳被爆風掃到的其他炸彈 */
function blast(g: Game, owner: SPlayer, b: SBomb, mult: number, spec: BombSpec): SBomb[] {
  // 火藥（紫）過載：引信剩越久（＝提早被連鎖引爆）傷害越高
  const overload = 1 + b.overload * Math.max(0, b.fuse) / Math.max(0.01, b.fuseMax)
  const dmg = b.damage * mult * overload
  const ignoreDr = eff(owner, 'kbBurnThrough') > 0

  g.ev({ t: 'aoe', x: Math.round(b.x), y: Math.round(b.y), r: Math.round(b.arm), kind: 'cross', w: b.crossX ? 'x' : undefined })

  // 敵人
  for (const e of g.enemies) {
    if (e.hp <= 0 || !inBlast(b, e.x, e.y, e.radius)) continue
    let d = dmg
    if (spec.flameAmp && inOwnFlame(g, owner, e.x, e.y)) d *= 1.25
    const [kx, ky] = norm(e.x - b.x, e.y - b.y)
    damageEnemyImpl(g, e, d, { ownerId: owner.id, knockX: kx * 240, knockY: ky * 240, srcX: b.x, srcY: b.y, ignoreDr })
  }
  if (g.boss && inBlast(b, g.boss.x, g.boss.y, g.boss.data.radius)) damageBoss(g, dmg, owner.id, b.x, b.y)

  // 把主人炸飛（0 傷害 + 無敵幀）——炸彈是位移工具
  if (owner.status === 'alive' && inBlast(b, owner.x, owner.y, 20)) {
    let [kx, ky] = norm(owner.x - b.x, owner.y - b.y)
    if (kx === 0 && ky === 0) { kx = 1; ky = 0 }
    owner.kbVx = kx * BOMB.selfPush
    owner.kbVy = ky * BOMB.selfPush
    owner.kbUntil = g.time + 0.22
    owner.buffs.invulnUntil = Math.max(owner.buffs.invulnUntil, g.time + BOMB.selfIframe)
    if (eff(owner, 'kbBombJump')) { owner.buffs.hasteUntil = g.time + 1.5; owner.buffs.hasteAmt = 0.5 }
  }

  // 火痕（只有主炸彈留；否則子炸彈/火痕引爆會不斷生出新的可引爆火痕）
  if (b.flameDur > 0 && b.gen === 0) {
    g.zones.push({
      x: b.x, y: b.y, radius: b.arm * 0.55, dps: Math.max(2, dmg * 0.12), hps: 0,
      until: g.time + b.flameDur, ownerId: owner.id, kind: 'fire', hostile: false, tick: 0,
      ignite: spec.flameIgnite,
    })
  }

  // 二段引信：0.5 秒後原地再炸一次（40%）
  if (eff(owner, 'kbDoubleTap') && b.gen === 0) {
    placeBomb(g, owner, spec, b.x, b.y, 1, 0.4 * mult, 0.5)
  }

  // 異常核（紅）：爆風末端生子炸彈
  if (b.sub && b.gen === 0) {
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      placeBomb(g, owner, spec, b.x + dx * b.arm, b.y + dy * b.arm, 1, 1, BOMB.subFuse)
    }
  }

  // 火焰核（紫）：把自己的火痕也引爆（火痕成為連鎖介質）
  if (spec.flameIgnite) {
    for (const z of g.zones) {
      if (!z.ignite || z.ownerId !== owner.id || !inBlast(b, z.x, z.y, z.radius * 0.5)) continue
      z.ignite = false
      placeBomb(g, owner, spec, z.x, z.y, 1, 0.5, 0.05)
    }
  }

  // 連鎖：爆風掃到的其他炸彈。
  // born < g.time 很重要——否則這次爆炸剛生出來的子炸彈/二段引信會被自己的爆風立刻引爆，
  // 「擴散」就變成「原地多打一次」。
  return g.bombs.filter(o => !o.dead && o !== b && o.born < g.time && inBlast(b, o.x, o.y, 12))
}

function inOwnFlame(g: Game, p: SPlayer, x: number, y: number): boolean {
  return g.zones.some(z => z.kind === 'fire' && z.ownerId === p.id && dist2(x, y, z.x, z.y) < z.radius ** 2)
}

// ---------------------------------------------------------------- 惡夢枕

export function throwPillow(g: Game, p: SPlayer, aimX: number, aimY: number, sp: number): void {
  const prm = p.char.active.params ?? {}
  const [nx, ny] = norm(aimX - p.x, aimY - p.y)
  const spec = buildSpec(g, p)
  const dist = prm.throw ?? 260
  const pillow: SPillow = {
    x: p.x + nx * dist, y: p.y + ny * dist,
    until: g.time + (prm.dur ?? 2.5),
    radius: (prm.radius ?? 260) * p.stats.area * g.skillRadiusScale(p),
    pull: prm.pull ?? 130,
    slow: prm.slow ?? 0.3,
    damage: (prm.damage ?? 40) * p.stats.damage * sp,
    arm: spec.arm + (prm.power ?? 3) * BOMB.cell,
    ownerId: p.id,
  }
  clampArena(pillow, 40)
  g.pillows.push(pillow)
}

function pillowsTick(g: Game, dt: number): void {
  for (const pl of g.pillows) {
    if (g.time >= pl.until) continue
    // 吸引 + 減速
    for (const e of g.enemies) {
      if (e.hp <= 0 || dist2(e.x, e.y, pl.x, pl.y) > pl.radius ** 2) continue
      const [dx, dy] = norm(pl.x - e.x, pl.y - e.y)
      e.x += dx * pl.pull * dt
      e.y += dy * pl.pull * dt
      e.slowUntil = g.time + 0.3
      e.slowPct = Math.max(e.slowPct, pl.slow)
    }
  }
  const done = g.pillows.filter(pl => g.time >= pl.until)
  g.pillows = g.pillows.filter(pl => g.time < pl.until)
  for (const pl of done) explodePillow(g, pl)
}

/** 核心自爆：巨型十字 + 引爆全場（或半徑內）炸彈 → 一次總連鎖 */
function explodePillow(g: Game, pl: SPillow): void {
  const owner = g.players.get(pl.ownerId)
  if (!owner) return
  const spec = buildSpec(g, owner)

  // 核心本身當成一顆「虛擬炸彈」，讓它走同一條連鎖流程
  const core: SBomb = {
    i: g.bombSeq++, x: pl.x, y: pl.y, fuse: 0, fuseMax: 1,
    damage: pl.damage, arm: pl.arm, ownerId: owner.id, gen: 1,
    crossX: spec.crossX, sub: false, contact: false, impatient: false, overload: 0,
    flameDur: spec.flameDur, born: g.time, dead: false,
  }
  g.bombs.push(core)

  const seeds = spec.detAll
    ? myBombs(g, owner)
    : [core, ...myBombs(g, owner).filter(b => dist2(b.x, b.y, pl.x, pl.y) < pl.radius ** 2)]

  // 惡夢殘響：留下夢魘地帶
  if (eff(owner, 'kbEcho')) {
    g.zones.push({
      x: pl.x, y: pl.y, radius: pl.radius * 0.8, dps: 0, hps: 0,
      until: g.time + 5, ownerId: owner.id, kind: 'frost', hostile: false, tick: 0, slowPct: 0.4,
    })
  }
  detonate(g, seeds)
}

// ---------------------------------------------------------------- 對外 hook

/** 每波開場：彈藥箱（紫）鋪 3 顆 */
export function bombsOnWaveStart(g: Game, p: SPlayer): void {
  if (!isKunbao(p)) return
  p.bombCd = 0; p.drowsy = 0; p.remoteCd = 6; p.sleepTalkCd = 2
  const spec = buildSpec(g, p)
  for (let k = 0; k < spec.waveStart; k++) {
    const a = (k / Math.max(1, spec.waveStart)) * Math.PI * 2
    placeBomb(g, p, spec, p.x + Math.cos(a) * 80, p.y + Math.sin(a) * 80)
  }
}

/** 遙控器（紫）保命同步：致命傷時引爆身邊炸彈並無敵 1 秒。回傳 true = 這次傷害被擋下 */
export function bombsDeathSave(g: Game, p: SPlayer): boolean {
  if (!isKunbao(p) || g.time < p.deathSyncAt) return false
  if (!buildSpec(g, p).deathSync) return false
  const near = myBombs(g, p).filter(b => dist2(b.x, b.y, p.x, p.y) < 200 ** 2)
  if (!near.length) return false
  p.deathSyncAt = g.time + 30
  p.hp = 1
  p.buffs.invulnUntil = Math.max(p.buffs.invulnUntil, g.time + 1)
  detonate(g, near)
  g.toastTo(p, '⏱️ 保命同步！身邊的炸彈替你擋下了', 'good')
  return true
}

/** 睡意量表（每 tick 由 playersTick 呼叫）。moved = 這個 tick 有沒有真的移動。 */
export function drowsyTick(g: Game, p: SPlayer, dt: number, moved: boolean): void {
  if (!isKunbao(p)) return
  const eternal = eff(p, 'kbEternalNight') > 0
  if (g.time < p.wakeLockUntil) {
    p.drowsy = 0
  } else if (moved && !eternal) {
    p.drowsy = Math.max(0, p.drowsy - BOMB.drowsyLoss * dt)
  } else {
    p.drowsy = Math.min(100, p.drowsy + BOMB.drowsyGain * (1 + 0.3 * eff(p, 'kbDoze')) * dt)
  }
  if (drowsyTier(p.drowsy) === 2) {
    healPlayer(g, p, p.stats.maxHp * BOMB.deepRegenPct * dt)
    p.fx = 'doze'; p.fxUntil = g.time + 0.3
  }
}

/** 受擊：打醒（睡意歸零 + 鎖睡意 + 開啟貪睡鬧鐘窗口） */
export function wakeUp(g: Game, p: SPlayer): void {
  if (!isKunbao(p)) return
  p.drowsy = 0
  p.wakeLockUntil = g.time + (eff(p, 'kbBreath') ? 0.3 : BOMB.wakeLock)
  if (eff(p, 'kbAlarm')) p.alarmUntil = g.time + 3
}

/** 熟睡減傷（厚棉被） */
export function drowsyDr(p: SPlayer): number {
  if (!isKunbao(p) || drowsyTier(p.drowsy) !== 2) return 0
  return Math.min(0.5, 0.25 * eff(p, 'kbQuilt'))
}
