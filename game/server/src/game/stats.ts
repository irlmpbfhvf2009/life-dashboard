// 玩家數值合成：角色基礎 + 等級 + 升級 statMods + 詛咒/被動調整。
// 唯一的合成入口 — 任何系統都不要自己算數值。
import type { ComputedStats, StatKey } from '../../../shared/types'
import { UPGRADE_MAP } from '../../../shared/content/index'
import type { SPlayer } from './state'

const ADDITIVE: Set<StatKey> = new Set(['maxHp', 'armor', 'regen', 'pickupRange', 'projectiles', 'pierce', 'lifeOnKill'])

export function recomputeStats(p: SPlayer): void {
  const b = p.char.baseStats
  const add: Record<string, number> = {}
  const pct: Record<string, number> = {}
  const bump = (k: StatKey, v: number) => {
    if (ADDITIVE.has(k)) add[k] = (add[k] ?? 0) + v
    else pct[k] = (pct[k] ?? 0) + v
  }

  for (const [id, stacks] of p.upgrades) {
    const u = UPGRADE_MAP.get(id)
    if (!u?.statMods) continue
    for (const [k, v] of Object.entries(u.statMods)) bump(k as StatKey, (v as number) * stacks)
  }
  // 寶箱 boon（永久戰力）
  for (const [k, v] of Object.entries(p.boonMods ?? {})) bump(k as StatKey, v as number)
  if (p.char.passive.mods) {
    for (const [k, v] of Object.entries(p.char.passive.mods)) bump(k as StatKey, v as number)
  }
  // 菁英獵人勳章：永久傷害
  if (p.effects.has('eliteTrophy')) pct.damage = (pct.damage ?? 0) + p.eliteTrophyStacks * 0.03

  const lvl = p.level - 1
  // 暴擊率溢出：超過 100% 的部分 1:1 轉成暴擊傷害（賭徒等暴擊 build 才不會滿爆就浪費）
  const rawCrit = b.critChance + (pct.critChance ?? 0)
  const critOverflow = Math.max(0, rawCrit - 1)
  // 下限保護：取捨型 boon（血怒菌株/重錘孢子…）帶負值，疊多也不能把屬性打到 0 或負
  const s: ComputedStats = {
    maxHp: Math.max(30, Math.round((b.maxHp + lvl * 3 + (add.maxHp ?? 0)) * (p.effects.has('curseGlass') ? 0.75 : 1))),
    armor: Math.max(0, b.armor + (add.armor ?? 0)),
    regen: p.effects.has('curseShell') ? 0 : b.regen + (add.regen ?? 0),
    pickupRange: b.pickupRange + (add.pickupRange ?? 0),
    projectiles: add.projectiles ?? 0,
    pierce: add.pierce ?? 0,
    lifeOnKill: add.lifeOnKill ?? 0,
    moveSpeed: b.moveSpeed * Math.max(0.5, 1 + (pct.moveSpeed ?? 0)),
    // 傷害＝基礎 ×(1+加算%＋等級加成) × boon 乘算 × 乘算階梯（複利刀法/倍力精華/禁忌菜譜）
    // —— 乘算是後期傷害滾到百萬/千萬的引擎；賢者之石(sage)讓每等級加成翻倍（經驗 build 的出口）
    damage: b.damage * Math.max(0.15, 1 + (pct.damage ?? 0) + lvl * 0.02 * (1 + (p.effects.get('sage') ?? 0)))
      * (p.boonDmgMult ?? 1)
      * Math.pow(1.08, p.effects.get('dmgXr') ?? 0)
      * Math.pow(1.18, p.effects.get('dmgXe') ?? 0)
      * Math.pow(1.4, p.effects.get('dmgX') ?? 0),
    attackSpeed: b.attackSpeed * Math.max(0.3, 1 + (pct.attackSpeed ?? 0)),
    critChance: Math.min(1, Math.max(0, rawCrit)),
    critDamage: b.critDamage + (pct.critDamage ?? 0) + critOverflow,
    cooldown: Math.min(0.6, pct.cooldown ?? 0),
    area: Math.max(0.4, 1 + (pct.area ?? 0)),
    goldGain: 1 + (pct.goldGain ?? 0),
    xpGain: 1 + (pct.xpGain ?? 0),
    reviveSpeed: 1 + (pct.reviveSpeed ?? 0) + (p.char.passive.effect === 'auraHealFastRescue' ? 0.4 : 0),
    luck: 1 + (pct.luck ?? 0),
    dodge: Math.min(0.7, Math.max(0, pct.dodge ?? 0)),   // 閃避率上限 70%
  }
  const hpPct = p.stats ? p.hp / Math.max(1, p.stats.maxHp) : 1
  p.stats = s
  p.hp = Math.min(Math.round(s.maxHp * hpPct), s.maxHp)
  p.skillMaxCharges = p.effects.has('skillCharges') ? 2 : 1
}

/** 重新推導 specialEffect 表（升級變動時呼叫，順便重算數值） */
export function recomputeEffects(p: SPlayer): void {
  p.effects = new Map()
  for (const [id, stacks] of p.upgrades) {
    const u = UPGRADE_MAP.get(id)
    if (u?.specialEffect) p.effects.set(u.specialEffect, (p.effects.get(u.specialEffect) ?? 0) + stacks)
  }
  recomputeStats(p)
}

export const eff = (p: SPlayer, id: string) => p.effects.get(id) ?? 0
export const maxWeapons = (p: SPlayer) => 6 + (p.effects.has('curseBag') ? 1 : 0)
