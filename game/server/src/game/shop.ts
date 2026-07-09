// 商店 + 升級三選一 + 寶箱 + 團隊獎勵（免費多選）。
import {
  WEAPONS, WEAPON_MAP, UPGRADES, UPGRADE_MAP, CHEST_BOONS, BOSS_BOONS,
  TEAM_REWARDS, ITEMS,
} from '../../../shared/content/index'
import { SHOP } from '../../../shared/balance'
import { weightedR, intR, shuffleR } from '../../../shared/rng'
import type { Rarity, ShopOffer, UpgradeData, ChestPending, WeaponData, ChestBoonData } from '../../../shared/types'
import type { SPlayer } from './state'
import { newOwnedWeapon } from './state'
import type { Game } from './game'
import { recomputeEffects, eff, maxWeapons } from './stats'
import { healPlayer, addReviveShard } from './drops'

let offerSeq = 1
const oid = () => `o${offerSeq++}`

// 穿透/多管升級只在「目前持有能吃到的武器」時才上架（共用池時代不能再用角色判定）。
const PIERCE_UPGRADES = new Set(UPGRADES.filter(u => u.statMods && 'pierce' in u.statMods).map(u => u.id))
const MULTI_UPGRADES = new Set(UPGRADES.filter(u => u.statMods && 'projectiles' in u.statMods).map(u => u.id))

// -------------------------------------------------------- 武器池（共用池 + 簽名武器 + 親和權重）

/** 此玩家可取得的武器池：共用池 + 自己的簽名武器（排除進化型/已滿級）。
 *  武器欄已滿 → 只出「已持有」的武器（買了＝升級），不再出新武器。 */
function weaponPool(p: SPlayer): WeaponData[] {
  const full = p.weapons.length >= maxWeapons(p)
  return WEAPONS.filter(w => !w.evolvedForm && (!w.charId || w.charId === p.char.id)).filter(w => {
    const owned = p.weapons.find(x => x.data.id === w.id)
    if (full && !owned) return false
    return !owned || owned.level < w.maxLevel
  })
}

/** 依角色親和 tag 加權抽武器：簽名武器與親和 tag 權重高，但任何武器都抽得到 */
function pickWeaponWeighted(g: Game, p: SPlayer, pool: WeaponData[]): WeaponData | null {
  if (!pool.length) return null
  const aff = new Set(p.char.affinityTags ?? [])
  const entries = pool.map(wd => ({
    wd,
    weight: 1 + (wd.charId ? 1.5 : 0)
      + wd.tags.reduce((s, t) => s + (aff.has(t) ? 0.8 : 0), 0)
      + (p.weapons.some(x => x.data.id === wd.id) ? 1.2 : 0),   // 已持有 → 容易再出現讓你升級
  }))
  return weightedR(g.rng, entries).wd
}

// -------------------------------------------------------- 資格判定

function upgradeEligible(g: Game, p: SPlayer, u: UpgradeData): boolean {
  if ((p.upgrades.get(u.id) ?? 0) >= u.maxStacks) return false
  if (u.conflicts?.some(c => p.upgrades.has(c))) return false
  // 武器精研：有可升級的武器才上架
  if (u.specialEffect === 'weaponLevelUp' && !p.weapons.some(w => w.level < w.data.maxLevel)) return false
  if (PIERCE_UPGRADES.has(u.id) && !p.weapons.some(w => w.data.behavior === 'projectile' || w.data.behavior === 'drone')) return false
  if (MULTI_UPGRADES.has(u.id) && !p.weapons.some(w => ['projectile', 'drone', 'orbit'].includes(w.data.behavior))) return false
  // 單人遊戲：完全不出合作/團隊類升級（救援護盾、並肩作戰、共享資源…都沒意義）
  if (u.category === 'coop' && g.playerCount === 1) return false
  for (const req of u.requirements ?? []) {
    if (req.startsWith('char:') && p.char.id !== req.slice(5)) return false
    if (req.startsWith('weaponTag:') && !p.weapons.some(w => w.data.tags.includes(req.slice(10)))) return false
  }
  return true
}

/** 稀有度擲骰（幸運 / 賭徒被動 / 任務 rareBoost / 路線 rareChance 影響）。
 *  幸運乘在「整條機率」上（含波數成長）——疊幸運的 build 後期商店明顯更金光閃閃。 */
function rollRarity(g: Game, p: SPlayer, allowCursed: boolean): Rarity {
  const luck = p.stats.luck * (1 + g.nextRareBoost + g.routeMods.rareChance)
  const gambler = p.char.passive.effect === 'gamblerLuck'
  let r = g.rng()
  if (gambler && g.rng() < 0.25) r *= 0.55       // 賭徒：往稀有偏
  const epicP = (0.06 + g.wave * 0.003) * luck
  const rareP = (0.22 + g.wave * 0.006) * luck
  const legP = Math.max(0, (0.008 + Math.max(0, g.wave - 8) * 0.002) * luck)
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
  // 武器精研保底：有可升級的武器時，35% 機率佔一格——武器（尤其簽名武器）才有免費升級管道
  const wup = UPGRADE_MAP.get('w_up')
  if (wup && upgradeEligible(g, p, wup) && g.rng() < 0.35) {
    seen.add('w_up')
    p.levelupChoices.push({ offerId: oid(), upgradeId: 'w_up' })
  }
  while (p.levelupChoices.length < 3) {
    let filled = false
    for (let tries = 0; tries < 8; tries++) {
      const u = pickUpgradeByRarity(g, p, rollRarity(g, p, p.char.passive.effect === 'gamblerLuck'))
      if (u && !seen.has(u.id)) { seen.add(u.id); p.levelupChoices.push({ offerId: oid(), upgradeId: u.id }); filled = true; break }
    }
    if (!filled) break
  }
}

export function applyUpgrade(g: Game, p: SPlayer, upgradeId: string): void {
  const u = UPGRADE_MAP.get(upgradeId)
  if (!u) return
  // 武器精研：即時效果，不佔升級欄——最低等級武器 +1 級（同級時職業專屬優先）
  if (u.specialEffect === 'weaponLevelUp') {
    const ws = p.weapons.filter(w => w.level < w.data.maxLevel)
    if (!ws.length) return
    ws.sort((a, b) => (a.level - b.level)
      || (b.data.charId === p.char.id ? 1 : 0) - (a.data.charId === p.char.id ? 1 : 0))
    const w = ws[0]
    w.level++
    syncWeaponOffers(g, p)
    g.toastTo(p, `⬆️ 武器精研：${w.data.name} → Lv.${w.level}`, 'good')
    return
  }
  p.upgrades.set(upgradeId, (p.upgrades.get(upgradeId) ?? 0) + 1)
  recomputeEffects(p)
  // 即時性效果
  if (u.specialEffect === 'curseShell') p.shield += 60
  if (u.specialEffect === 'skillCharges') p.skillMaxCharges = 2
}

// -------------------------------------------------------- 個人商店

/** 商店價格倍率（波數上浮 × 折扣 × 詛咒背包） */
function priceMultOf(g: Game, p: SPlayer): number {
  return (1 + g.wave * SHOP.priceWaveGrowth)
    * (1 - g.shopDiscountFor(p))
    * (eff(p, 'curseBag') ? 1.25 : 1)
}

const weaponOfferPrice = (g: Game, p: SPlayer, w: WeaponData, level: number, special: boolean) =>
  Math.max(1, Math.round(w.price * priceMultOf(g, p) * (special ? 0.85 : 1) * (1 + (level - 1) * 0.5)))

/** 後期波數：新武器的起始等級（省得從 Lv1 慢慢養） */
function weaponStartLevel(wave: number): number {
  if (wave >= 16) return 3
  if (wave >= 9) return 2
  return 1
}

/** 玩家角色的進化武器（後期商店偶爾直接販售；charId 綁該角色、evolvedForm） */
function evolvedForChar(p: SPlayer): WeaponData | null {
  const owned = new Set(p.weapons.map(w => w.data.id))
  const evo = WEAPONS.find(w => w.evolvedForm && w.charId === p.char.id && !owned.has(w.id))
  return evo ?? null
}

/** 任何管道取得/升級武器後，同步未售出的同武器上架格（等級標示+價格；滿級直接下架）。
 *  修掉「兩格同武器 Lv2/Lv2，買一格另一格不會變 Lv3」的舊 bug。 */
export function syncWeaponOffers(g: Game, p: SPlayer): void {
  for (const o of p.shopOffers) {
    if (o.kind !== 'weapon' || o.sold) continue
    const data = WEAPON_MAP.get(o.refId)
    if (!data) continue
    const owned = p.weapons.find(x => x.data.id === o.refId)
    if (owned && owned.level >= data.maxLevel) { o.sold = true; continue }   // 滿級 → 這格作廢
    const nextLevel = owned ? owned.level + 1 : (o.startLevel ?? 1)   // 未持有＝維持起始等級（後期可能 >1）
    if (o.weaponLevel !== nextLevel) {
      o.weaponLevel = nextLevel
      o.price = weaponOfferPrice(g, p, data, nextLevel, g.routeMods.specialShop)
      o.origPrice = undefined
    }
  }
}

export function generateShopOffers(g: Game, p: SPlayer): void {
  const kept = p.shopOffers.filter(o => o.locked && !o.sold)
  p.shopOffers = [...kept]
  const special = g.routeMods.specialShop
  const priceMult = priceMultOf(g, p)

  while (p.shopOffers.length < SHOP.offers) {
    const roll = g.rng()
    if (roll < 0.5) {   // 武器是 build 核心，出現率高（道具類已不上架）
      // 後期偶爾直接販售本角色的進化武器（wave≥12，非特價店 12% 機率）
      const evo = g.wave >= 12 && !special && g.rng() < 0.12 ? evolvedForChar(p) : null
      if (evo && !p.shopOffers.some(o => o.kind === 'weapon' && o.refId === evo.id && !o.sold)) {
        p.shopOffers.push({
          offerId: oid(), kind: 'weapon', refId: evo.id,
          price: weaponOfferPrice(g, p, evo, 1, special),
          locked: false, sold: false, weaponLevel: 1, startLevel: 1,
        })
        continue
      }
      // 共用池 + 簽名武器（親和 tag 加權）；同一把武器不重複上架
      const pool = weaponPool(p)
        .filter(w => special || w.tier <= (g.wave < 5 ? 2 : 3))
        .filter(w => !p.shopOffers.some(o => o.kind === 'weapon' && o.refId === w.id && !o.sold))
      const w = pickWeaponWeighted(g, p, pool)
      if (w) {
        const owned = p.weapons.find(x => x.data.id === w.id)
        // 後期新武器直接以較高等級入手（已持有則照升級路徑）
        const startLv = owned ? 1 : Math.min(weaponStartLevel(g.wave), w.maxLevel)
        const level = owned ? owned.level + 1 : startLv
        p.shopOffers.push({
          offerId: oid(), kind: 'weapon', refId: w.id,
          price: weaponOfferPrice(g, p, w, level, special),
          locked: false, sold: false,
          weaponLevel: level, startLevel: startLv,
        })
        continue
      }
    }
    // 升級：試抽 8 次（避開已上架的同名）；抽不到＝池子乾了 → 補福袋，保證商店永遠 4 格滿
    let filled = false
    for (let tries = 0; tries < 8; tries++) {
      const u = pickUpgradeByRarity(g, p, rollRarity(g, p, true))
      if (!u) break
      if (p.shopOffers.some(o => o.kind === 'upgrade' && o.refId === u.id)) continue
      p.shopOffers.push({ offerId: oid(), kind: 'upgrade', refId: u.id, price: Math.max(1, Math.round(u.price * priceMult)), locked: false, sold: false })
      filled = true
      break
    }
    if (!filled) {
      p.shopOffers.push({ offerId: oid(), kind: 'mystery', refId: '', price: Math.max(5, Math.round(8 + g.wave * 1.5)), locked: false, sold: false })
    }
  }

  // 🎁 福袋：35% 機率把一個非鎖定格換成福袋；其中 30% 是「稀有福袋」（金色、貴一倍、必開好料）
  if (g.rng() < 0.35) {
    const idx = p.shopOffers.findIndex(o => !o.locked && !o.sold && o.kind !== 'mystery')
    if (idx >= 0) {
      const rareBox = g.rng() < 0.3
      p.shopOffers[idx] = {
        offerId: oid(), kind: 'mystery', refId: rareBox ? 'rare' : '',
        price: Math.max(5, Math.round((rareBox ? 20 : 8) + g.wave * (rareBox ? 3 : 1.5))), locked: false, sold: false,
      }
    }
  }
  // 🏷️ 特價：一般 = 隨機一格打 4~5 折；12% 機率是「特價日」= 全店都打折
  const bargainDay = g.rng() < 0.12
  const saleable = p.shopOffers.filter(o => !o.sold && !o.origPrice && o.kind !== 'mystery')
  if (saleable.length) {
    const targets = bargainDay ? saleable : [saleable[Math.floor(g.rng() * saleable.length)]]
    for (const o of targets) {
      o.origPrice = o.price
      o.price = Math.max(1, Math.round(o.price * (bargainDay ? 0.6 : 0.5 + g.rng() * 0.1)))
    }
  }
}

export function buyOffer(g: Game, p: SPlayer, offerId: string): string | null {
  const o = p.shopOffers.find(o => o.offerId === offerId)
  if (!o || o.sold) return '找不到商品'
  if (p.gold < o.price) return '金幣不足'
  if (o.kind === 'weapon') {
    const err = addWeapon(g, p, o.refId, o.startLevel ?? 1)
    if (err) return err
    syncWeaponOffers(g, p)
  } else if (o.kind === 'upgrade') {
    applyUpgrade(g, p, o.refId)
  } else if (o.kind === 'mystery') {
    const rareBox = o.refId === 'rare'
    const pool = weaponPool(p)
    if (rareBox) {
      // ✨ 稀有福袋：必開好料 — 優先武器，否則稀有升級，否則大筆金幣
      const w = pickWeaponWeighted(g, p, pool)
      if (w) {
        addWeapon(g, p, w.id)
        syncWeaponOffers(g, p)
        g.toastTo(p, `✨ 稀有福袋開出：${w.name}！`, 'good')
      } else {
        const u = pickUpgradeByRarity(g, p, g.rng() < 0.4 ? 'epic' : 'rare')
        if (u) { applyUpgrade(g, p, u.id); g.toastTo(p, `✨ 稀有福袋開出：${u.name}！`, 'good') }
        else { const gold = 40 + g.wave * 4; p.gold += gold; g.toastTo(p, `✨ 稀有福袋開出：金幣 +${gold}！`, 'good') }
      }
    } else {
      // 🎁 一般福袋：50% 隨機武器、30% 隨機道具、20% 一筆金幣
      const r = g.rng()
      const w = r < 0.5 ? pickWeaponWeighted(g, p, pool) : null
      if (w) {
        addWeapon(g, p, w.id)
        syncWeaponOffers(g, p)
        g.toastTo(p, `🎁 福袋開出：${w.name}！`, 'good')
      } else if (r < 0.8) {
        const it = weightedR(g.rng, ITEMS)
        p.pendingItems.push(it.id)
        g.toastTo(p, `🎁 福袋開出：${it.name}！`, 'good')
      } else {
        const gold = 12 + g.wave * 2
        p.gold += gold
        g.toastTo(p, `🎁 福袋開出：金幣 +${gold}！`, 'good')
      }
    }
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

/** 簽名（職業專屬）武器：charId 綁本角色 → 不可出售 */
export function isSignatureWeapon(p: SPlayer, w: { data: WeaponData }): boolean {
  return !!w.data.charId && w.data.charId === p.char.id
}

export function sellWeapon(g: Game, p: SPlayer, index: number): string | null {
  if (p.weapons.length <= 1) return '至少要保留一把武器'
  const w = p.weapons[index]
  if (!w) return '找不到武器'
  if (isSignatureWeapon(p, w)) return '職業專屬武器無法出售'
  p.weapons.splice(index, 1)
  const refund = Math.round(w.data.price * (1 + (w.level - 1) * 0.5) * SHOP.sellPct)
  p.gold += refund
  syncWeaponOffers(g, p)
  return null
}

export function addWeapon(g: Game, p: SPlayer, weaponId: string, startLevel = 1): string | null {
  const data = WEAPON_MAP.get(weaponId)
  if (!data) return '未知武器'
  if (data.charId && data.charId !== p.char.id) return '這不是你的專屬武器'
  const owned = p.weapons.find(w => w.data.id === weaponId)
  if (owned) {
    if (owned.level >= data.maxLevel) return '已達最高等級'
    owned.level++
    return null
  }
  if (p.weapons.length >= maxWeapons(p)) return '武器欄已滿（可先賣掉一把）'
  const w = newOwnedWeapon(data, g.rng() * Math.PI * 2)
  w.level = Math.min(Math.max(1, startLevel), data.maxLevel)
  p.weapons.push(w)
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
    w.counter = 0; w.heat = 0; w.frenzyUntil = 0
    g.broadcastToast(`✨ ${p.name} 的武器進化 → ${into.name}！`, 'good')
    changed = true
  }
  if (changed) syncWeaponOffers(g, p)
  return changed
}

// -------------------------------------------------------- 寶箱

/** 寶箱三選一：全部是「永久戰力 boon」——build 成形（傷害滾雪球）的主要來源。
 *  池子含輸出/防禦/回復/功能/賭博（可能整排都不是你要的）；shiny 選項權重乘幸運。 */
export function rollChestOptions(g: Game, p: SPlayer): ChestPending['options'] {
  const n = 3 + (eff(p, 'chestBonus') ? 1 : 0) + (p.chestKeyBonus > 0 ? 1 : 0)
  if (p.chestKeyBonus > 0) p.chestKeyBonus--
  const opts: ChestPending['options'] = []
  const used = new Set<string>()
  const pool = CHEST_BOONS.map(b => ({ ...b, weight: b.weight * (b.shiny ? p.stats.luck : 1) }))
  for (let k = 0; k < n; k++) {
    for (let tries = 0; tries < 8; tries++) {
      const b = weightedR(g.rng, pool)
      if (used.has(b.id) && tries < 7) continue
      // 情境過濾
      if (b.effect === 'weaponUp' && !p.weapons.some(w => w.level < w.data.maxLevel)) continue
      if (b.effect === 'allWeaponUp' && !p.weapons.some(w => w.level < w.data.maxLevel)) continue
      if (b.effect === 'curse' && !UPGRADES.some(u => u.category === 'curse' && upgradeEligible(g, p, u))) continue
      if (used.has(b.id)) continue
      used.add(b.id)
      const detail = b.effect === 'gold' ? `金幣 +${goldReward(g)}` : b.detail
      opts.push({ rewardId: b.id, detail: `${b.name}：${detail}`, refId: b.id })
      break
    }
  }
  return opts
}

const goldReward = (g: Game) => Math.round((18 + g.wave * 2) * (1 + g.wave * 0.05))

/** 套用一個 boon（寶箱三選一與首領寶箱共用）；prefix 用於 toast 圖示 */
export function applyBoon(g: Game, p: SPlayer, boon: ChestBoonData, prefix = '✨'): void {
  // 永久屬性 boon
  if (boon.statMods) {
    for (const [k, v] of Object.entries(boon.statMods)) {
      p.boonMods[k] = (p.boonMods[k] ?? 0) + (v as number)
    }
    recomputeEffects(p)
    g.toastTo(p, `${prefix} ${boon.name}：${boon.detail}`, 'good')
    return
  }
  switch (boon.effect) {
    case 'dmgMult':
      p.boonDmgMult *= boon.params?.mult ?? 1.3
      recomputeEffects(p)
      g.toastTo(p, `${prefix} ${boon.name}：傷害 ×${boon.params?.mult ?? 1.3}（現在 ×${p.boonDmgMult.toFixed(2)}）`, 'good')
      break
    case 'skillPower':
      p.boonSkillPower++
      g.toastTo(p, `${prefix} ${boon.name}：技能傷害 +35%（共 +${p.boonSkillPower * 35}%）`, 'good')
      break
    case 'skillCd':
      p.boonSkillCd++
      g.toastTo(p, `${prefix} ${boon.name}：技能冷卻 -10%`, 'good')
      break
    case 'skillBoost':
      p.boonSkillPower += 2
      p.boonSkillCd++
      g.toastTo(p, `${prefix} ${boon.name}：技能傷害 +70%、冷卻 -10%`, 'good')
      break
    case 'waveShield':
      p.boonWaveShield += boon.params?.amount ?? 25
      p.shield += boon.params?.amount ?? 25
      g.toastTo(p, `${prefix} ${boon.name}：每波開場護盾 +${boon.params?.amount ?? 25}（共 ${p.boonWaveShield}）`, 'good')
      break
    case 'fullHeal':
      p.boonMods.maxHp = (p.boonMods.maxHp ?? 0) + (boon.params?.hp ?? 50)
      recomputeEffects(p)
      for (const q of g.players.values()) if (q.status === 'alive') healPlayer(g, q, q.stats.maxHp)
      g.toastTo(p, `${prefix} ${boon.name}：全體回滿、最大生命 +${boon.params?.hp ?? 50}`, 'good')
      break
    case 'richGold': {
      p.boonMods.goldGain = (p.boonMods.goldGain ?? 0) + 0.5
      recomputeEffects(p)
      const gold = goldReward(g) * 2
      p.gold += gold
      g.toastTo(p, `${prefix} ${boon.name}：金幣獲得 +50%、金幣 +${gold}`, 'good')
      break
    }
    case 'weaponUp': {
      const upgradable = p.weapons.filter(w => w.level < w.data.maxLevel)
      if (upgradable.length) {
        const w = upgradable[Math.floor(g.rng() * upgradable.length)]
        w.level++
        syncWeaponOffers(g, p)
        g.toastTo(p, `⬆️ ${w.data.name} → Lv.${w.level}`, 'good')
      } else { p.gold += 15; g.toastTo(p, '武器都滿級了，折抵 15 金幣') }
      break
    }
    case 'allWeaponUp': {
      const levels = boon.params?.levels ?? 1
      let n = 0
      for (const w of p.weapons) {
        for (let k = 0; k < levels && w.level < w.data.maxLevel; k++) { w.level++; n++ }
      }
      syncWeaponOffers(g, p)
      g.toastTo(p, `🚀 ${boon.name}：武器共升了 ${n} 級！`, 'good')
      break
    }
    case 'epicUpgrade': {
      const u = pickUpgradeByRarity(g, p, 'epic')
      if (u) { applyUpgrade(g, p, u.id); g.toastTo(p, `${prefix} 神秘天賦：${u.name}（${u.description}）`, 'good') }
      else { p.gold += 20; g.toastTo(p, '天賦已滿，折抵 20 金幣') }
      break
    }
    case 'gold': p.gold += goldReward(g); break
    case 'curse': {
      const pool = UPGRADES.filter(u => u.category === 'curse' && upgradeEligible(g, p, u))
      if (pool.length) {
        const u = pool[Math.floor(g.rng() * pool.length)]
        applyUpgrade(g, p, u.id)
        g.toastTo(p, `😈 ${u.name}：${u.description}`, 'warn')
      } else { p.gold += 15 }
      break
    }
  }
}

export function applyChestChoice(g: Game, p: SPlayer, chestId: string, rewardId: string): string | null {
  const chest = p.chests.find(c => c.chestId === chestId)
  if (!chest) return '找不到寶箱'
  const opt = chest.options.find(o => o.rewardId === rewardId)
  if (!opt) return '找不到獎勵'
  p.chests = p.chests.filter(c => c !== chest)
  const boon = CHEST_BOONS.find(b => b.id === rewardId)
  if (!boon) return '未知獎勵'
  applyBoon(g, p, boon)
  return null
}

/** 首領寶箱（每 5 波 Boss 必掉）：撿到當下，全體存活玩家各自「抽」一個超大獎——
 *  攻/防/回/輔都可能，開到什麼看命（抽獎賭博的快感）。 */
export function bossChestDraw(g: Game): void {
  g.broadcastToast('👑 首領寶箱！全員抽獎——', 'good')
  for (const p of g.players.values()) {
    if (!p.connected || p.status === 'dead') continue
    const boon = weightedR(g.rng, BOSS_BOONS)
    applyBoon(g, p, boon, '👑')
    g.broadcastToast(`👑 ${p.name} 抽中【${boon.name}】`, 'good')
  }
}

// -------------------------------------------------------- 團隊獎勵（每波免費多選）

/** 每人可選數量：1 人選 4、2 人各選 2、3~4 人各選 1（總量約 3~4） */
export function teamRewardPicksPerPlayer(playerCount: number): number {
  return playerCount <= 1 ? 4 : playerCount === 2 ? 2 : 1
}

export function rollTeamRewardOptions(g: Game) {
  // 提供整個池洗牌（讓單人一次可挑 4 個仍有足夠變化）
  return shuffleR(g.rng, TEAM_REWARDS.slice()).map(t => ({ id: t.id, name: t.name, description: t.description }))
}

export function applyTeamReward(g: Game, id: string): void {
  const t = TEAM_REWARDS.find(t => t.id === id)
  if (!t) return
  const prm = t.params ?? {}
  switch (t.effect) {
    case 'teamHealFull':
      // 回滿血並救起倒地隊友（死亡者仍需團隊復活）
      for (const p of g.players.values()) if (p.status !== 'dead') { p.status = 'alive'; healPlayer(g, p, p.stats.maxHp) }
      break
    case 'waveShield':
      g.team.waveShield += prm.amount                           // 永久：每波開場生效
      for (const p of g.players.values()) if (p.status === 'alive') p.shield += prm.amount   // 本波也立即補一次
      break
    case 'teamGold':
      for (const p of g.players.values()) p.gold += prm.amount
      break
    case 'bossDamage': g.team.bossDamage += prm.amount; break
    case 'nextWaveDropBoost': g.nextWaveDropBoost = Math.max(g.nextWaveDropBoost, prm.mult); break
    case 'randomWeaponUp': {
      const ps = [...g.players.values()].filter(p => p.weapons.some(w => w.level < w.data.maxLevel))
      if (ps.length) {
        const p = ps[Math.floor(g.rng() * ps.length)]
        const ws = p.weapons.filter(w => w.level < w.data.maxLevel)
        const w = ws[Math.floor(g.rng() * ws.length)]
        w.level++
        syncWeaponOffers(g, p)
        g.broadcastToast(`${p.name} 的 ${w.data.name} 升到 Lv.${w.level}！`, 'good')
      }
      break
    }
    case 'reviveShard': addReviveShard(g); break
  }
  g.broadcastToast(`團隊獎勵：${t.name}`, 'good')
}
