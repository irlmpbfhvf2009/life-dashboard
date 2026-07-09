// 掉落系統：生成、磁吸、撿取、超量合併、臨時道具效果、波末吸取。
import { DROPS, DROP_MERGE, caps, xpForLevel, coinWaveMult } from '../../../shared/balance'
import { ITEMS, ITEM_MAP } from '../../../shared/content/index'
import { weightedR, intR } from '../../../shared/rng'
import type { SDrop, SPlayer } from './state'
import type { Game } from './game'
import { dist2, nextId, clampArena } from './util'
import { healDropMult, rewardMult } from './director'
import { eff, recomputeStats } from './stats'
import { rollChestOptions, bossChestDraw } from './shop'

export function spawnDrop(g: Game, t: SDrop['t'], x: number, y: number, v = 0, item?: string): void {
  if (g.drops.length >= caps(g.playerCount).drops) mergeXpDrops(g)
  if (g.drops.length >= caps(g.playerCount).drops && (t === 'xp' || t === 'coin')) return
  // ×2 金幣（土豆兄弟式）：上一波沒吃到的金幣換成這一波的 ×2 charge，掉金幣時消耗
  let x2 = false
  if (t === 'coin' && g.goldX2Charges > 0) {
    g.goldX2Charges--
    v *= 2
    x2 = true
  }
  const d: SDrop = { i: nextId(), t, x, y, v, item, x2, magnetTargetId: null, bornAt: g.time }
  clampArena(d, 30)
  g.drops.push(d)
  g.ev({ t: 'drop', d: { i: d.i, t, x: Math.round(x), y: Math.round(y), v, it: item, x2: x2 ? 1 : undefined } })
}

/** 超量時合併鄰近經驗球（效能保護） */
function mergeXpDrops(g: Game): void {
  const xps = g.drops.filter(d => d.t === 'xp')
  const r2 = DROP_MERGE.xpMergeRadius ** 2
  for (let i = 0; i < xps.length; i++) {
    const a = xps[i]
    if (a.v <= 0) continue
    for (let j = i + 1; j < xps.length; j++) {
      const b = xps[j]
      if (b.v <= 0) continue
      if (dist2(a.x, a.y, b.x, b.y) < r2) { a.v += b.v; b.v = -1 }
    }
  }
  for (const d of g.drops) {
    if (d.v === -1) g.ev({ t: 'pick', i: d.i, id: '' })
  }
  g.drops = g.drops.filter(d => d.v !== -1)
}

/** 擊殺掉落（怪物死亡時呼叫） */
export function dropsFromKill(g: Game, x: number, y: number, opts: {
  xpSize: number; coinChance: number; elite: boolean; boss?: boolean; luck?: number
}): void {
  const rm = rewardMult(g) * g.routeMods.rewardMult * g.routeMods.dropMult * (g.eventMods.dropMult ?? 1)
  // 經驗：不再掉球，擊殺直接發給全體存活玩家（各自吃 xpGain 加成）
  const xpVal = Math.round(DROPS.xpValue[opts.boss ? 3 : opts.xpSize] * rm) * (opts.boss ? 8 : 1)
  for (const p of g.players.values()) {
    if (p.connected && p.status === 'alive') addXpDirect(g, p, xpVal * p.stats.xpGain)
  }
  // 金幣（全域緊縮倍率 → 錢要花在刀口上；單枚價值隨波數成長，後期乘算升級才買得起）
  const coinMult = (g.eventMods.coinMult ?? 1) * g.routeMods.goldMult
  const waveMult = coinWaveMult(g.wave)
  if (opts.boss) {
    for (let k = 0; k < 6; k++) spawnDrop(g, 'coin', x + (g.rng() - 0.5) * 160, y + (g.rng() - 0.5) * 160, Math.ceil(DROPS.bossCoin * waveMult / 6))
  } else if (opts.elite) {
    spawnDrop(g, 'coin', x, y, Math.round((intR(g.rng, DROPS.coinValue.min, DROPS.coinValue.max) + DROPS.eliteCoinBonus) * coinMult * waveMult))
  } else if (g.rng() < opts.coinChance * coinMult * DROPS.coinChanceMult) {
    spawnDrop(g, 'coin', x, y, Math.max(1, Math.round(intR(g.rng, DROPS.coinValue.min, DROPS.coinValue.max) * waveMult)))
  }
  // 補血（受導演壓力調節 — 壓力高掉更多）
  if (g.rng() < DROPS.heartChance * healDropMult(g)) {
    const team = g.playerCount > 1 && g.rng() < DROPS.teamHeartChance
    const big = !team && g.rng() < DROPS.bigHeartChance
    spawnDrop(g, 'heart', x, y, big ? DROPS.bigHeartHeal : DROPS.heartHeal, team ? 'team' : undefined)
  }
  // 臨時道具
  if (g.rng() < DROPS.itemChance) {
    spawnDrop(g, 'item', x, y, 0, weightedR(g.rng, ITEMS).id)
  }
  // 寶箱（Boss 掉「首領寶箱」——撿到全員直接抽超大獎）；菁英寶箱率乘擊殺者幸運
  if (opts.boss) {
    spawnDrop(g, 'chest', x, y, 0, 'boss')
  } else if (opts.elite && g.rng() < Math.min(0.6, DROPS.chestChanceElite * (opts.luck ?? 1))) {
    spawnDrop(g, 'chest', x, y)
  }
}

export function dropsTick(g: Game, dt: number): void {
  const alive = [...g.players.values()].filter(p => p.connected && p.status === 'alive')
  if (!alive.length) return
  const speed = DROPS.magnetSpeed * dt
  for (const d of g.drops) {
    // 磁吸目標
    if (!d.magnetTargetId) {
      for (const p of alive) {
        const range = d.t === 'chest' || d.t === 'orb' ? 46 : p.stats.pickupRange
        if (dist2(d.x, d.y, p.x, p.y) < range * range) { d.magnetTargetId = p.id; break }
      }
    }
    if (d.magnetTargetId) {
      const p = g.players.get(d.magnetTargetId)
      if (!p || p.status !== 'alive') { d.magnetTargetId = null; continue }
      const dx = p.x - d.x, dy = p.y - d.y
      const dd = Math.hypot(dx, dy)
      if (dd < 26) { collect(g, p, d); continue }
      d.x += (dx / dd) * speed
      d.y += (dy / dd) * speed
    }
  }
  g.drops = g.drops.filter(d => !d.magnetTargetId || g.drops.includes(d))
}

function collect(g: Game, p: SPlayer, d: SDrop): void {
  g.drops = g.drops.filter(x => x !== d)
  g.ev({ t: 'pick', i: d.i, id: p.id })
  switch (d.t) {
    case 'xp': gainXp(g, p, d.v); break
    case 'coin': gainGold(g, p, d.v, true); break
    case 'heart': {
      if (d.item === 'team') {
        for (const q of g.players.values()) if (q.status === 'alive') { healPlayer(g, q, DROPS.teamHeartHeal); g.toastTo(q, `💗 團隊愛心：生命 +${DROPS.teamHeartHeal}`, 'good') }
      } else { healPlayer(g, p, d.v); g.toastTo(p, `💚 生命 +${Math.round(d.v)}`, 'good') }
      break
    }
    case 'item': if (d.item) applyItem(g, p, d.item); break
    case 'chest': {
      if (d.item === 'boss') {
        // 首領寶箱：撿到當下全員各自抽一個超大獎（不用等中場）
        g.ev({ t: 'chestOpen', x: d.x, y: d.y, reward: 'boss' })
        bossChestDraw(g)
        break
      }
      p.chests.push({ chestId: `ch${d.i}`, options: rollChestOptions(g, p) })
      g.ev({ t: 'chestOpen', x: d.x, y: d.y, reward: '' })
      g.ev({ t: 'toast', msg: `${p.name} 撿到寶箱！中場開啟`, kind: 'good' })
      break
    }
    case 'orb': {
      if (g.mission?.data.type === 'orbs' && !g.mission.done) {
        g.mission.progress++
      }
      break
    }
    case 'shard': addReviveShard(g, p.name); break
  }
}

export function addReviveShard(g: Game, byName?: string): void {
  g.team.reviveShards++
  if (g.team.reviveShards >= 3) {
    g.team.reviveShards -= 3
    g.team.revives++
    g.ev({ t: 'toast', msg: '復活碎片 ×3 → 團隊復活 +1！', kind: 'good' })
  } else if (byName) {
    g.ev({ t: 'toast', msg: `${byName} 獲得復活碎片（${g.team.reviveShards}/3）`, kind: 'good' })
  }
}

export function gainXp(g: Game, p: SPlayer, v: number): void {
  const shareRange = 400 * (1 + eff(p, 'xpShareRange') * 0.5)
  addXp(g, p, v * p.stats.xpGain)
  for (const q of g.players.values()) {
    if (q !== p && q.status === 'alive' && dist2(p.x, p.y, q.x, q.y) < shareRange * shareRange) {
      addXp(g, q, v * 0.6 * q.stats.xpGain)
    }
  }
}

function addXp(g: Game, p: SPlayer, v: number): void {
  p.xp += v
  p.wave.xp += v
  p.total.xp += v
  while (p.xp >= xpForLevel(p.level)) {
    p.xp -= xpForLevel(p.level)
    p.level++
    p.pendingLevelups++
    recomputeStats(p)
    p.hp = Math.min(p.stats.maxHp, p.hp + 5)
    g.ev({ t: 'lvup', id: p.id, lv: p.level })
  }
}

/** 擊殺直接發經驗（經驗不再掉落地面） */
export function addXpDirect(g: Game, p: SPlayer, v: number): void { addXp(g, p, v) }

export function gainGold(g: Game, p: SPlayer, v: number, allowShare: boolean): void {
  const amt = Math.round(v * p.stats.goldGain * (g.eventMods.coinMult ?? 1) * (eff(p, 'curseGreed') ? 1.5 : 1))
  p.gold += amt
  p.wave.gold += amt
  p.total.gold += amt
  if (allowShare && eff(p, 'coinShare')) {
    for (const q of g.players.values()) {
      if (q !== p && q.status === 'alive' && dist2(p.x, p.y, q.x, q.y) < 500 * 500) {
        const share = Math.floor(amt * 0.3)
        if (share > 0) { q.gold += share; q.wave.gold += share; q.total.gold += share }
      }
    }
  }
}

export function healPlayer(g: Game, p: SPlayer, amount: number): void {
  if (p.status !== 'alive') return
  const healPow = 1 + eff(p, 'healPower') * 0.3
  p.hp = Math.min(p.stats.maxHp, p.hp + amount * healPow)
}

// -------------------------------------------------------- 臨時道具

/** 道具拾取的效果說明（顯示給玩家看，讓「膠囊」不再看不懂變化了什麼） */
function itemEffectText(g: Game, p: SPlayer, itemId: string): string {
  const it = ITEM_MAP.get(itemId)!
  const prm = it.params ?? {}
  switch (it.effect) {
    case 'magnetAll': return '🧲 吸取全場掉落物'
    case 'clearBomb': return `💣 清場：對周圍敵人造成 ${prm.damage} 傷害`
    case 'invuln': return `🛡️ 無敵 ${prm.duration} 秒`
    case 'hasteBuff': return `⚡ 移速 +${Math.round(prm.amount * 100)}%（${prm.duration} 秒）`
    case 'rageBuff': return `🔥 攻速 +${Math.round(prm.amount * 100)}%（${prm.duration} 秒）`
    case 'freezeNearby': return `❄️ 凍結周圍敵人 ${prm.duration} 秒`
    case 'skillCd': return `🔮 技能冷卻 -${Math.round(prm.amount * 100)}%`
    case 'chestKey': return '🗝️ 寶箱鑰匙：下次開寶箱多 1 個選項'
    case 'instantHeal': return `💊 生命 +${Math.round(p.stats.maxHp * prm.pct)}（${Math.round(prm.pct * 100)}%）`
    default: return `${it.emoji} ${it.name}`
  }
}

export function applyItem(g: Game, p: SPlayer, itemId: string): void {
  const it = ITEM_MAP.get(itemId)
  if (!it) return
  const prm = it.params ?? {}
  g.ev({ t: 'item', id: p.id, it: itemId })
  // instantGold 走金幣、不特別提示（使用者說金幣不用顯示）
  if (it.effect !== 'instantGold') g.toastTo(p, itemEffectText(g, p, itemId), 'good')
  switch (it.effect) {
    case 'magnetAll':
      for (const d of g.drops) if (d.t !== 'chest') d.magnetTargetId = p.id
      break
    case 'clearBomb': {
      g.ev({ t: 'aoe', x: p.x, y: p.y, r: prm.radius, kind: 'explosion' })
      for (const e of g.enemies) {
        if (dist2(e.x, e.y, p.x, p.y) < prm.radius * prm.radius) g.damageEnemy(e, prm.damage, { ownerId: p.id })
      }
      break
    }
    case 'invuln': p.buffs.invulnUntil = g.time + prm.duration; break
    case 'hasteBuff': p.buffs.hasteUntil = g.time + prm.duration; p.buffs.hasteAmt = prm.amount; break
    case 'rageBuff': p.buffs.rageUntil = g.time + prm.duration; p.buffs.rageAmt = prm.amount; break
    case 'freezeNearby': {
      g.ev({ t: 'aoe', x: p.x, y: p.y, r: prm.radius, kind: 'frost' })
      for (const e of g.enemies) {
        if (dist2(e.x, e.y, p.x, p.y) >= prm.radius * prm.radius) continue
        if (e.elite) { e.slowUntil = g.time + prm.duration; e.slowPct = Math.max(e.slowPct, 0.5) }  // 菁英不被定身
        else e.frozenUntil = g.time + prm.duration
      }
      break
    }
    case 'skillCd': p.skillCdLeft *= 1 - prm.amount; break
    case 'chestKey': p.chestKeyBonus = (p.chestKeyBonus ?? 0) + 1; break
    case 'instantGold': gainGold(g, p, intR(g.rng, prm.min, prm.max), false); break
    case 'instantHeal': healPlayer(g, p, p.stats.maxHp * prm.pct); break
  }
}

/** 波次結束：金幣「不」自動吸——沒吃到的變成下一波的 ×2 金幣 charge（土豆兄弟式）；
 *  其餘掉落物（愛心/道具/寶箱）照舊自動入袋。 */
export function vacuumAll(g: Game): void {
  let missedCoins = 0
  for (const d of g.drops.slice()) {
    if (d.t === 'coin') { missedCoins++; g.ev({ t: 'pick', i: d.i, id: '' }); continue }
    // 找最近的存活玩家收走
    let best: SPlayer | null = null
    let bd = Infinity
    for (const p of g.players.values()) {
      if (p.status === 'dead') continue
      const dd = dist2(d.x, d.y, p.x, p.y)
      if (dd < bd) { bd = dd; best = p }
    }
    if (best) collect(g, best, d)
  }
  g.drops = []
  if (missedCoins > 0) {
    g.goldX2Charges = Math.min(50, g.goldX2Charges + missedCoins)
    g.broadcastToast(`💰 沒撿的 ${missedCoins} 枚金幣 → 下一波前 ${missedCoins} 枚金幣 ×2！`, 'info')
  }
}
