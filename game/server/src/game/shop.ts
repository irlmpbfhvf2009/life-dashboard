// 商店 + 升級三選一 + 寶箱 + 團隊商店（投票）+ 團隊獎勵。
import {
  WEAPONS, WEAPON_MAP, UPGRADES, UPGRADE_MAP, CHEST_REWARDS,
  TEAM_SHOP_MAP, TEAM_REWARDS, ITEMS,
} from '../../../shared/content/index'
import { SHOP } from '../../../shared/balance'
import { weightedR, intR, shuffleR } from '../../../shared/rng'
import type { Rarity, ShopOffer, UpgradeData, ChestPending } from '../../../shared/types'
import type { SPlayer } from './state'
import type { Game } from './game'
import { recomputeEffects, eff, maxWeapons } from './stats'
import { healPlayer, addReviveShard } from './drops'

let offerSeq = 1
const oid = () => `o${offerSeq++}`

// -------------------------------------------------------- 資格判定

function upgradeEligible(g: Game, p: SPlayer, u: UpgradeData): boolean {
  if ((p.upgrades.get(u.id) ?? 0) >= u.maxStacks) return false
  if (u.conflicts?.some(c => p.upgrades.has(c))) return false
  if (u.category === 'coop' && g.playerCount === 1 && ['c_pos1', 'c_pos2', 'c_pos3', 'c_pos4', 'c_res1', 'c_res2', 'c_def3', 'c_def4', 'c_rescue3', 'c_rescue4'].includes(u.id)) return false
  for (const req of u.requirements ?? []) {
    if (req.startsWith('char:') && p.char.id !== req.slice(5)) return false
    if (req.startsWith('weaponTag:') && !p.weapons.some(w => w.data.tags.includes(req.slice(10)))) return false
  }
  return true
}

/** 稀有度擲骰（幸運 / 賭徒被動 / 任務 rareBoost / 路線 rareChance 影響） */
function rollRarity(g: Game, p: SPlayer, allowCursed: boolean): Rarity {
  const luck = p.stats.luck * (1 + g.nextRareBoost + g.routeMods.rareChance)
  const gambler = p.char.passive.effect === 'gamblerLuck'
  let r = g.rng()
  if (gambler && g.rng() < 0.25) r *= 0.55       // 賭徒：往稀有偏
  const epicP = 0.06 * luck + g.wave * 0.003
  const rareP = 0.22 * luck + g.wave * 0.006
  const legP = Math.max(0, 0.008 * luck + (g.wave - 8) * 0.002)
  if (allowCursed && (gambler ? g.rng() < 0.12 : g.rng() < 0.05)) return 'cursed'
  if (r < legP) return 'legendary'
  if (r < legP + epicP) return 'epic'
  if (r < legP + epicP + rareP) return 'rare'
  return 'common'
}

function pickUpgradeByRarity(g: Game, p: SPlayer, rarity: Rarity): UpgradeData | null {
  let pool = UPGRADES.filter(u => u.rarity === rarity && upgradeEligible(g, p, u))
  if (!pool.length) pool = UPGRADES.filter(u => u.rarity === 'common' && upgradeEligible(g, p, u))
  if (!pool.length) return null
  return weightedR(g.rng, pool)
}

// -------------------------------------------------------- 升級三選一

export function rollLevelupChoices(g: Game, p: SPlayer): void {
  p.levelupChoices = []
  const seen = new Set<string>()
  for (let k = 0; k < 3; k++) {
    for (let tries = 0; tries < 8; tries++) {
      const u = pickUpgradeByRarity(g, p, rollRarity(g, p, p.char.passive.effect === 'gamblerLuck'))
      if (u && !seen.has(u.id)) { seen.add(u.id); p.levelupChoices.push({ offerId: oid(), upgradeId: u.id }); break }
    }
  }
}

export function applyUpgrade(g: Game, p: SPlayer, upgradeId: string): void {
  const u = UPGRADE_MAP.get(upgradeId)
  if (!u) return
  p.upgrades.set(upgradeId, (p.upgrades.get(upgradeId) ?? 0) + 1)
  recomputeEffects(p)
  // 即時性效果
  if (u.specialEffect === 'curseShell') p.shield += 60
  if (u.specialEffect === 'skillCharges') p.skillMaxCharges = 2
}

// -------------------------------------------------------- 個人商店

export function generateShopOffers(g: Game, p: SPlayer): void {
  const kept = p.shopOffers.filter(o => o.locked && !o.sold)
  p.shopOffers = [...kept]
  const priceMult = (1 + g.wave * SHOP.priceWaveGrowth)
    * (1 - g.shopDiscountFor(p))
    * (eff(p, 'curseBag') ? 1.25 : 1)
  const special = g.routeMods.specialShop

  while (p.shopOffers.length < SHOP.offers) {
    const roll = g.rng()
    if (roll < 0.38) {
      // 武器（進化型不進商店；已滿級的不再出現）
      const pool = WEAPONS.filter(w => !w.evolvedForm).filter(w => {
        const owned = p.weapons.find(x => x.data.id === w.id)
        return !owned || owned.level < w.maxLevel
      }).filter(w => special || w.tier <= (g.wave < 5 ? 2 : 3))
      if (pool.length) {
        const w = pool[Math.floor(g.rng() * pool.length)]
        const owned = p.weapons.find(x => x.data.id === w.id)
        p.shopOffers.push({
          offerId: oid(), kind: 'weapon', refId: w.id,
          price: Math.max(1, Math.round(w.price * priceMult * (special ? 0.85 : 1) * (owned ? 1 + owned.level * 0.5 : 1))),
          locked: false, sold: false,
          weaponLevel: owned ? owned.level + 1 : 1,
        })
        continue
      }
    }
    if (roll < 0.5 && g.rng() < 0.3) {
      // 臨時道具直購
      const it = weightedR(g.rng, ITEMS)
      p.shopOffers.push({ offerId: oid(), kind: 'item', refId: it.id, price: Math.max(1, Math.round(6 * priceMult)), locked: false, sold: false })
      continue
    }
    const u = pickUpgradeByRarity(g, p, rollRarity(g, p, true))
    if (!u) break
    if (p.shopOffers.some(o => o.kind === 'upgrade' && o.refId === u.id)) continue
    p.shopOffers.push({ offerId: oid(), kind: 'upgrade', refId: u.id, price: Math.max(1, Math.round(u.price * priceMult)), locked: false, sold: false })
  }
}

export function buyOffer(g: Game, p: SPlayer, offerId: string): string | null {
  const o = p.shopOffers.find(o => o.offerId === offerId)
  if (!o || o.sold) return '找不到商品'
  if (p.gold < o.price) return '金幣不足'
  if (o.kind === 'weapon') {
    const err = addWeapon(g, p, o.refId)
    if (err) return err
  } else if (o.kind === 'upgrade') {
    applyUpgrade(g, p, o.refId)
  } else {
    // 道具存到下一波開場直接生效 → 直接套用簡化為立即生效於下波（先立即入袋）
    p.pendingItems.push(o.refId)
  }
  p.gold -= o.price
  o.sold = true
  return null
}

export function refreshShop(g: Game, p: SPlayer): string | null {
  const cost = SHOP.refreshBase + p.refreshCount * SHOP.refreshGrowth
  if (p.gold < cost) return '金幣不足'
  p.gold -= cost
  p.refreshCount++
  p.shopOffers = p.shopOffers.filter(o => o.locked && !o.sold)
  generateShopOffers(g, p)
  return null
}

export function sellWeapon(g: Game, p: SPlayer, index: number): string | null {
  if (p.weapons.length <= 1) return '至少要保留一把武器'
  const w = p.weapons[index]
  if (!w) return '找不到武器'
  p.weapons.splice(index, 1)
  const refund = Math.round(w.data.price * (1 + (w.level - 1) * 0.5) * SHOP.sellPct)
  p.gold += refund
  return null
}

export function addWeapon(g: Game, p: SPlayer, weaponId: string): string | null {
  const data = WEAPON_MAP.get(weaponId)
  if (!data) return '未知武器'
  const owned = p.weapons.find(w => w.data.id === weaponId)
  if (owned) {
    if (owned.level >= data.maxLevel) return '已達最高等級'
    owned.level++
    return null
  }
  if (p.weapons.length >= maxWeapons(p)) return '武器欄已滿（可先賣掉一把）'
  p.weapons.push({ data, level: 1, cdLeft: 0, orbitAngle: g.rng() * Math.PI * 2, hitMemo: new Map() })
  return null
}

/** 武器進化：滿級 + 擁有指定升級（id 或 tag）→ 自動變成進化型。中場每次刷新都檢查一次。 */
export function checkEvolutions(g: Game, p: SPlayer): boolean {
  let changed = false
  for (const w of p.weapons) {
    const evo = w.data.evolution
    if (!evo || w.data.evolvedForm || w.level < w.data.maxLevel) continue
    const met = p.upgrades.has(evo.requires)
      || [...p.upgrades.keys()].some(id => UPGRADE_MAP.get(id)?.tags.includes(evo.requires))
    if (!met) continue
    const into = WEAPON_MAP.get(evo.into)
    if (!into) continue
    w.data = into
    w.level = 1
    w.cdLeft = 0
    w.hitMemo = new Map()
    g.broadcastToast(`✨ ${p.name} 的武器進化 → ${into.name}！`, 'good')
    changed = true
  }
  return changed
}

// -------------------------------------------------------- 寶箱

export function rollChestOptions(g: Game, p: SPlayer): ChestPending['options'] {
  const n = 2 + (eff(p, 'chestBonus') ? 1 : 0) + (p.chestKeyBonus > 0 ? 1 : 0)
  if (p.chestKeyBonus > 0) p.chestKeyBonus--
  const opts: ChestPending['options'] = []
  const used = new Set<string>()
  for (let k = 0; k < n; k++) {
    for (let tries = 0; tries < 6; tries++) {
      const cr = weightedR(g.rng, CHEST_REWARDS)
      if (used.has(cr.id) && tries < 5) continue
      used.add(cr.id)
      switch (cr.type) {
        case 'gold': {
          const amt = intR(g.rng, 12, 20) + g.wave * 2
          opts.push({ rewardId: cr.id, detail: `金幣 +${amt}`, refId: String(amt) })
          break
        }
        case 'weapon': {
          const pool = WEAPONS.filter(x => !x.evolvedForm)
          const w = pool[Math.floor(g.rng() * pool.length)]
          opts.push({ rewardId: cr.id, detail: `武器：${w.name}`, refId: w.id })
          break
        }
        case 'upgrade': {
          const u = pickUpgradeByRarity(g, p, g.rng() < 0.5 ? 'rare' : 'epic')
          if (!u) continue
          opts.push({ rewardId: cr.id, detail: `升級：${u.name}`, refId: u.id })
          break
        }
        case 'reviveShard':
          opts.push({ rewardId: cr.id, detail: '復活碎片 ×1', refId: '' })
          break
        case 'curse': {
          const pool = UPGRADES.filter(u => u.category === 'curse' && upgradeEligible(g, p, u))
          if (!pool.length) continue
          const u = pool[Math.floor(g.rng() * pool.length)]
          opts.push({ rewardId: cr.id, detail: `詛咒：${u.name}（${u.description}）`, refId: u.id })
          break
        }
      }
      break
    }
  }
  return opts
}

export function applyChestChoice(g: Game, p: SPlayer, chestId: string, rewardId: string): string | null {
  const chest = p.chests.find(c => c.chestId === chestId)
  if (!chest) return '找不到寶箱'
  const opt = chest.options.find(o => o.rewardId === rewardId)
  if (!opt) return '找不到獎勵'
  p.chests = p.chests.filter(c => c !== chest)
  switch (rewardId) {
    case 'cr_gold': p.gold += Number(opt.refId); break
    case 'cr_weapon': {
      const err = addWeapon(g, p, opt.refId!)
      if (err) { p.gold += 15; g.toastTo(p, `武器欄已滿，折抵 15 金幣`) }
      break
    }
    case 'cr_upgrade': case 'cr_curse': applyUpgrade(g, p, opt.refId!); break
    case 'cr_shard': addReviveShard(g, p.name); break
  }
  return null
}

// -------------------------------------------------------- 團隊商店

export function teamShopVote(g: Game, p: SPlayer, itemId: string, yes: boolean): void {
  if (!TEAM_SHOP_MAP.has(itemId)) return
  let votes = g.team.teamShopVotes.get(itemId)
  if (!votes) { votes = new Set(); g.team.teamShopVotes.set(itemId, votes) }
  if (yes) votes.add(p.id)
  else votes.delete(p.id)
  tryBuyTeamItem(g, itemId)
}

function connectedCount(g: Game): number {
  return [...g.players.values()].filter(p => p.connected).length
}

function tryBuyTeamItem(g: Game, itemId: string): void {
  const item = TEAM_SHOP_MAP.get(itemId)!
  if (g.team.teamShopBought.has(itemId)) return
  const votes = g.team.teamShopVotes.get(itemId)
  const need = Math.max(1, Math.ceil(connectedCount(g) / 2))
  if (!votes || votes.size < need) return
  // 分攤價格（含團購折扣升級）
  const discount = Math.max(0, ...[...g.players.values()].map(p => eff(p, 'teamShopDiscount') * 0.15), g.nextTeamShopDiscount)
  const each = Math.ceil(item.price * (1 - discount) / Math.max(1, connectedCount(g)))
  const payers = [...g.players.values()].filter(p => p.connected)
  if (payers.some(p => p.gold < each)) {
    g.broadcastToast(`團隊道具「${item.name}」有人金幣不足（每人需 ${each}）`, 'warn')
    g.team.teamShopVotes.delete(itemId)
    return
  }
  for (const p of payers) p.gold -= each
  g.team.teamShopBought.add(itemId)
  g.team.teamShopVotes.delete(itemId)
  applyTeamItem(g, itemId)
  g.broadcastToast(`✅ 團隊購買「${item.name}」（每人 ${each} 金幣）`, 'good')
}

function applyTeamItem(g: Game, itemId: string): void {
  const item = TEAM_SHOP_MAP.get(itemId)!
  const prm = item.params ?? {}
  switch (item.effect) {
    case 'teamHealPct':
      for (const p of g.players.values()) if (p.status === 'alive') healPlayer(g, p, p.stats.maxHp * prm.pct)
      break
    case 'nextWaveShield': g.nextWaveShield += prm.amount; break
    case 'buyRevive': g.team.revives++; break
    case 'bossDamage': g.team.bossDamage += prm.amount; break
    case 'objectiveHp': g.team.objectiveHp += prm.amount; break
    case 'nextShopDiscount': g.nextTeamShopDiscount = Math.max(g.nextTeamShopDiscount, prm.amount); break
    case 'nextWaveDropBoost': g.nextWaveDropBoost = Math.max(g.nextWaveDropBoost, prm.mult); break
  }
}

export function teamReviveVote(g: Game, p: SPlayer): void {
  g.team.reviveVotes.add(p.id)
  const need = Math.max(1, Math.ceil(connectedCount(g) / 2))
  if (g.team.reviveVotes.size < need) return
  const price = SHOP.teamReviveBasePrice + g.team.revivesBought * SHOP.teamRevivePriceGrowth
  const discount = Math.max(0, ...[...g.players.values()].map(q => eff(q, 'reviveCostDown') * 0.25))
  const each = Math.ceil(price * (1 - discount) / Math.max(1, connectedCount(g)))
  const payers = [...g.players.values()].filter(q => q.connected)
  if (payers.some(q => q.gold < each)) {
    g.broadcastToast(`購買團隊復活失敗：有人金幣不足（每人需 ${each}）`, 'warn')
    g.team.reviveVotes.clear()
    return
  }
  for (const q of payers) q.gold -= each
  g.team.revives++
  g.team.revivesBought++
  g.team.reviveVotes.clear()
  g.broadcastToast(`✅ 團隊復活 +1（每人 ${each} 金幣）`, 'good')
}

// -------------------------------------------------------- 團隊獎勵（第一關固定三選一）

export function rollTeamRewardOptions(g: Game) {
  return shuffleR(g.rng, TEAM_REWARDS.slice()).slice(0, 3).map(t => ({ id: t.id, name: t.name, description: t.description }))
}

export function applyTeamReward(g: Game, id: string): void {
  const t = TEAM_REWARDS.find(t => t.id === id)
  if (!t) return
  const prm = t.params ?? {}
  switch (t.effect) {
    case 'teamHealPct':
      for (const p of g.players.values()) if (p.status !== 'dead') { p.status = 'alive'; healPlayer(g, p, p.stats.maxHp * prm.pct) }
      break
    case 'teamGold':
      for (const p of g.players.values()) p.gold += prm.amount
      break
    case 'nextWaveDropBoost': g.nextWaveDropBoost = Math.max(g.nextWaveDropBoost, prm.mult); break
    case 'randomWeaponUp': {
      const ps = [...g.players.values()].filter(p => p.weapons.some(w => w.level < w.data.maxLevel))
      if (ps.length) {
        const p = ps[Math.floor(g.rng() * ps.length)]
        const ws = p.weapons.filter(w => w.level < w.data.maxLevel)
        const w = ws[Math.floor(g.rng() * ws.length)]
        w.level++
        g.broadcastToast(`${p.name} 的 ${w.data.name} 升到 Lv.${w.level}！`, 'good')
      }
      break
    }
    case 'reviveShard': addReviveShard(g); break
  }
  g.broadcastToast(`團隊獎勵：${t.name}`, 'good')
}
