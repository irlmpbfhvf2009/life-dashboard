// 睏寶（kunbao）的放置炸彈系統 —— 設計書見 game/DESIGN-kunbao.md
//
// 玩法＝經典放置炸彈：
//   * 主動技能就是「在腳下的格子放一顆炸彈」，**沒有冷卻**。
//   * 技能上的數字＝儲存次數＝「同時炸彈上限 − 場上已有的炸彈數」。
//     放 2 顆 → 剩 3；其中一顆爆掉 → 回到 4。放滿 → 0，按不動。
//   * 炸彈對齊格心，**一格只能放一顆**（不重疊）。
//   * 引信燒完 → 十字爆風（火力＝往四方各炸幾格）。
//   * 爆風掃到別的炸彈 → 立刻引爆它（連鎖），第 n 段傷害遞增。
//
// 六個武器欄不是六把武器，是「同一顆炸彈的六個模組」：
//   彈藥箱(數量) 火焰核(格數) 引信(時機) 踢靴(操作) 遙控器(引爆) 異常核(形狀)
// buildSpec() 把它們合成一份 BombSpec；放彈時把 spec 快照進 SBomb。
//
// 護欄（不是平衡旋鈕，別拿掉）：連鎖段數上限、同時炸彈硬上限、子炸彈不再生子炸彈。
import { BOMB, drowsyTier, ARENA } from '../../../shared/balance'
import type { SPlayer, SBomb } from './state'
import type { Game } from './game'
import { dist2, norm, clampArena } from './util'
import { damageEnemyImpl } from './enemies'
import { damageBoss } from './boss'
import { eff } from './stats'
import { healPlayer } from './drops'

export const isKunbao = (p: SPlayer) => p.char.passive.effect === 'dreamFuse'

/** 模組等級（0 = 未持有；1~4 = 白/藍/紫/紅） */
const mod = (p: SPlayer, id: string) => p.weapons.find(w => w.data.id === id)?.level ?? 0

/** 座標 → 格心（炸彈一律對齊格心，才能「一格一顆、不重疊」） */
export const snapCell = (v: number) => Math.floor(v / BOMB.cell) * BOMB.cell + BOMB.cell / 2

export interface BombSpec {
  fuse: number
  damage: number
  power: number           // 火力＝往四方各炸幾格
  arm: number             // 爆風臂長（px）＝ power × cell
  stock: number           // 同時炸彈上限（＝技能儲存次數）
  crossX: boolean         // 異常核（藍）X 型斜臂
  sub: boolean            // 異常核（紅）子炸彈
  contact: boolean        // 引信（紅）碰到即爆
  impatient: boolean      // 引信（紫）沒人踩就自己燒完
  flameDur: number        // 火焰核（藍+）火痕秒數
  flameIgnite: boolean    // 火焰核（紫）火痕可被爆風再引爆
  flameAmp: boolean       // 火焰核（紅）火痕內敵人受爆炸傷害 +25%
  kick: number            // 踢靴等級 0~4
  remote: number          // 遙控器等級 0~4
}

/** 六模組 → 一顆炸彈的規格。等級效果是累積的（紅階同時擁有白藍紫的效果）。 */
export function buildSpec(g: Game, p: SPlayer): BombSpec {
  const fuseL = mod(p, 'k_fuse'), flameL = mod(p, 'k_flame'), crateL = mod(p, 'k_crate')
  const kickL = mod(p, 'k_kick'), remoteL = mod(p, 'k_remote'), coreL = mod(p, 'k_core')
  const tier = drowsyTier(p.drowsy)

  // ── 引信（睡意越深燒越快；貪睡鬧鐘＝被打醒後的反擊窗口）
  let fuse: number = BOMB.baseFuse
  fuse -= 0.3 * Math.min(2, fuseL)                     // 白 −0.3、藍 −0.6（紫紅是行為，不再縮短）
  if (tier >= 1) fuse += BOMB.lightFuse
  fuse -= 0.2 * eff(p, 'kbShortFuse')
  if (eff(p, 'kbSleepTalk') && tier === 2) fuse *= 0.6  // 夢話：熟睡時引信更短
  if (eff(p, 'kbParadox')) fuse *= 0.2
  fuse = Math.max(0.25, fuse)

  // ── 傷害（沒有「純傷害模組」：靠商店屬性、等級、連鎖）
  let damage = (BOMB.baseDamage + p.stats.flatDamage) * p.stats.damage * (1 + p.stats.engineerDamage)
  if (eff(p, 'kbFusion')) damage *= 3
  if (eff(p, 'kbParadox')) damage *= 0.4

  // ── 火力（爆風格數）
  let power = BOMB.basePower
    + ([0, 1, 2, 2, 4][flameL] ?? 0)
    + eff(p, 'kbPower')
    + eff(p, 'kunMastery')
    + (tier === 2 ? BOMB.deepPower : 0)
    + (eff(p, 'kbFusion') ? 3 : 0)
    + (g.time < p.alarmUntil ? 2 : 0)                  // 貪睡鬧鐘
  power = Math.max(1, power)
  const arm = power * BOMB.cell * (coreL >= 3 ? 1.4 : 1) * p.stats.area

  // ── 庫存（＝技能儲存次數）
  let stock = BOMB.baseStock + ([0, 1, 2, 3, 4][crateL] ?? 0) + eff(p, 'kbStock')
  if (eff(p, 'kbFusion')) stock -= 3
  stock = Math.max(1, Math.min(BOMB.hardStock, stock))

  return {
    fuse, damage, power, arm, stock,
    crossX: coreL >= 2, sub: coreL >= 4,
    contact: fuseL >= 4, impatient: fuseL >= 3,
    flameDur: flameL >= 2 ? (flameL >= 4 ? 3 : 1.5) : 0,
    flameIgnite: flameL >= 3, flameAmp: flameL >= 4,
    kick: kickL, remote: remoteL,
  }
}

const chainCap = (p: SPlayer) => (eff(p, 'kbDomino') ? Infinity : BOMB.chainCap + 2 * eff(p, 'kbChainCap'))
const chainStep = (p: SPlayer) => (eff(p, 'kbReactor') ? 0.20 : BOMB.chainStep)

/** 我的炸彈（依放置順序，[0] 最舊） */
const myBombs = (g: Game, p: SPlayer) => g.bombs.filter(b => b.ownerId === p.id && !b.dead)

/** 這一格已經有炸彈了嗎（含正在滑行的） */
const cellTaken = (g: Game, cx: number, cy: number) =>
  g.bombs.some(b => !b.dead && Math.abs(b.x - cx) < 1 && Math.abs(b.y - cy) < 1)

// ---------------------------------------------------------------- 放彈

export function placeBomb(g: Game, p: SPlayer, spec: BombSpec, x: number, y: number, gen = 0, dmgMult = 1, fuseOverride?: number): SBomb | null {
  if (g.bombs.length >= BOMB.hardStock * 2) return null      // 全場硬上限（多人）
  const cx = snapCell(x), cy = snapCell(y)
  if (cellTaken(g, cx, cy)) return null                      // 一格一顆
  const b: SBomb = {
    i: g.bombSeq++, x: cx, y: cy, vx: 0, vy: 0,
    fuse: fuseOverride ?? spec.fuse, fuseMax: fuseOverride ?? spec.fuse,
    damage: spec.damage * dmgMult,
    arm: gen > 0 ? Math.max(BOMB.cell, spec.arm - 2 * BOMB.cell) : spec.arm,
    ownerId: p.id, gen,
    crossX: spec.crossX, sub: spec.sub && gen === 0,         // 子炸彈不再生子炸彈
    contact: spec.contact, impatient: spec.impatient,
    overload: 0, flameDur: spec.flameDur,
    armed: gen > 0,        // 主炸彈剛放在腳下：先不可踢，等主人走離這一格
    born: g.time, dead: false,
  }
  clampArena(b, 18)
  g.bombs.push(b)
  return b
}

/**
 * 主動技能：在腳下放一顆炸彈（無冷卻）。
 * 庫存用完時，若有遙控器則改為「引爆」（白＝最舊的一顆、藍以上＝全部）。
 */
export function kunbaoSkill(g: Game, p: SPlayer): void {
  const spec = buildSpec(g, p)
  const mine = myBombs(g, p)
  if (mine.length < spec.stock) {
    const b = placeBomb(g, p, spec, p.x, p.y)
    if (!b) g.toastTo(p, '這一格已經有炸彈了', 'warn')
    return
  }
  if (spec.remote >= 1) {
    detonate(g, spec.remote >= 2 ? mine : [mine[0]])
    return
  }
  g.toastTo(p, '炸彈用完了——等一顆爆掉', 'warn')
}

/** 技能儲存次數：場上每有一顆炸彈就少一發（快照送 sc/smc 給 HUD） */
export function bombCharges(g: Game, p: SPlayer): { charges: number; max: number } {
  const spec = buildSpec(g, p)
  return { charges: Math.max(0, spec.stock - myBombs(g, p).length), max: spec.stock }
}

// ---------------------------------------------------------------- 每 tick

export function bombsTick(g: Game, dt: number): void {
  for (const p of g.players.values()) {
    if (!p.connected || p.status !== 'alive' || !isKunbao(p)) continue
    const spec = buildSpec(g, p)
    const mine = myBombs(g, p)

    // 技能儲存次數（HUD 直接讀 SPlayer.skillCharges）
    p.skillCharges = Math.max(0, spec.stock - mine.length)
    p.skillMaxCharges = spec.stock
    p.skillCdLeft = 0

    // 「站在剛放下的炸彈上」→ 走離這一格之後它才變成實心（可踢）。這是經典放置炸彈的規則。
    for (const b of mine) {
      if (!b.armed && dist2(b.x, b.y, p.x, p.y) > (BOMB.cell * 0.75) ** 2) b.armed = true
    }
    // 踢靴：走「進」一顆已經離腳的炸彈才會踢它
    if (spec.kick >= 1) kickTick(g, p, spec)

    // 定時同步：所有炸彈引信對齊到最短的那顆
    if (eff(p, 'kbSync') && mine.length > 1) {
      const min = Math.min(...mine.map(b => b.fuse))
      for (const b of mine) b.fuse = min
    }
  }

  // 滑行 + 引信燃燒 + 觸發判定
  const triggered: SBomb[] = []
  for (const b of g.bombs) {
    if (b.dead) continue
    const owner = g.players.get(b.ownerId)
    if (b.vx || b.vy) slideTick(g, b, owner, dt)
    b.fuse -= dt

    if (owner && !b.vx && !b.vy) {
      const near = nearestEnemyDist2(g, b.x, b.y)
      if (b.contact && near < 30 ** 2) b.fuse = 0                                   // 一觸即發
      else if (eff(owner, 'kbStepOn') && near < 34 ** 2 && b.fuse > b.fuseMax * 0.5) b.fuse = b.fuseMax * 0.5
      else if (b.impatient && g.time - b.born > 1 && near > 200 ** 2 && b.fuse > 0.4) b.fuse = 0.4
    }
    if (b.fuse <= 0) triggered.push(b)
  }
  if (triggered.length) detonate(g, triggered)
}

/**
 * 踢靴（經典放置炸彈規則）：
 *   * 剛放在腳下的炸彈不會被踢——你可以站在上面，走離那一格後它才「變實心」。
 *   * 踢的條件是你**走進**一顆實心炸彈：要正在移動、而且移動方向朝著它。
 *   * 踢出去的方向鎖在上下左右四個格線方向（不是任意角度），這樣才踢得準。
 */
function kickTick(g: Game, p: SPlayer, spec: BombSpec): void {
  const mx = p.lastX - p.x, my = p.lastY - p.y
  const dd = Math.hypot(mx, my)
  if (dd < 6) return                                    // 沒在移動就不踢
  const ux = mx / dd, uy = my / dd
  for (const b of g.bombs) {
    if (b.dead || b.ownerId !== p.id || b.vx || b.vy || !b.armed) continue
    const bx = b.x - p.x, by = b.y - p.y
    const d = Math.hypot(bx, by)
    if (d > 42) continue                                // 還沒碰到
    if ((bx * ux + by * uy) / (d || 1) < 0.5) continue  // 不是「走進去」，是擦過或走開
    // 方向鎖 4 向：取移動的主軸
    const [kx, ky] = Math.abs(ux) >= Math.abs(uy) ? [Math.sign(ux), 0] : [0, Math.sign(uy)]
    b.vx = kx * BOMB.kickSpeed
    b.vy = ky * BOMB.kickSpeed
    if (spec.kick >= 3) b.fuse *= 0.5                   // 紫：踢出的炸彈引信減半
    g.ev({ t: 'aoe', x: Math.round(b.x), y: Math.round(b.y), r: 20, kind: 'deploy' })
    break                                               // 一次只踢一顆
  }
}

/** 滑行中的炸彈：撞牆停下、撞敵人停下（藍以上造成傷害、紅立刻引爆） */
function slideTick(g: Game, b: SBomb, owner: SPlayer | undefined, dt: number): void {
  const kick = owner ? mod(owner, 'k_kick') : 0
  b.x += b.vx * dt
  b.y += b.vy * dt
  let stop = false

  if (b.x < 20 || b.x > ARENA.w - 20 || b.y < 20 || b.y > ARENA.h - 20) { clampArena(b, 20); stop = true }

  for (const e of g.enemies) {
    if (e.hp <= 0 || dist2(e.x, e.y, b.x, b.y) > (e.radius + 16) ** 2) continue
    if (owner && kick >= 2) {
      const [kx, ky] = norm(e.x - b.x, e.y - b.y)
      damageEnemyImpl(g, e, b.damage * 0.6, { ownerId: owner.id, knockX: kx * 300, knockY: ky * 300, srcX: b.x, srcY: b.y })
    }
    if (kick >= 4) b.fuse = 0              // 紅：撞到敵人立刻引爆
    stop = true
    break
  }

  if (stop) {
    b.vx = 0; b.vy = 0
    b.armed = true
    // 停下時對齊格心；若那一格已被占走就退回上一格，避免兩顆疊在一起
    const cx = snapCell(b.x), cy = snapCell(b.y)
    if (!g.bombs.some(o => o !== b && !o.dead && Math.abs(o.x - cx) < 1 && Math.abs(o.y - cy) < 1)) { b.x = cx; b.y = cy }
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
  if (spec.remote >= 4) {
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
    if (seg - healedAt >= BOMB.chainHealEvery) { healedAt = seg; healPlayer(g, owner, owner.stats.maxHp * BOMB.chainHealPct) }
  }

  g.bombs = g.bombs.filter(b => !b.dead)

  if (seg >= 5) {
    if (eff(owner, 'kbSurf')) owner.buffs.invulnUntil = Math.max(owner.buffs.invulnUntil, g.time + 2)
    if (seg >= 8 && eff(owner, 'kbBreed')) placeBomb(g, owner, spec, owner.x + BOMB.cell, owner.y)
    g.toastTo(owner, `💥 連鎖 ${seg} 段！`, 'good')
  }
}

/** 單顆炸彈的爆風：傷害、擊退、把主人炸飛、火痕、子炸彈；回傳被爆風掃到的其他炸彈 */
function blast(g: Game, owner: SPlayer, b: SBomb, mult: number, spec: BombSpec): SBomb[] {
  const dmg = b.damage * mult
  const ignoreDr = eff(owner, 'kbBurnThrough') > 0

  g.ev({ t: 'aoe', x: Math.round(b.x), y: Math.round(b.y), r: Math.round(b.arm), kind: 'cross', w: b.crossX ? 'x' : undefined })

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
  if (eff(owner, 'kbDoubleTap') && b.gen === 0) placeBomb(g, owner, spec, b.x, b.y, 1, 0.4 * mult, 0.5)

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

// ---------------------------------------------------------------- 對外 hook

export function bombsOnWaveStart(g: Game, p: SPlayer): void {
  if (!isKunbao(p)) return
  p.drowsy = 0
  p.skillCdLeft = 0
  p.skillCharges = buildSpec(g, p).stock
}

/** 遙控器（紫）保命同步：致命傷時引爆身邊炸彈並無敵 1 秒。回傳 true = 這次傷害被擋下 */
export function bombsDeathSave(g: Game, p: SPlayer): boolean {
  if (!isKunbao(p) || g.time < p.deathSyncAt) return false
  if (buildSpec(g, p).remote < 3) return false
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
