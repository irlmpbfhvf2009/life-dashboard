import type { WeaponData } from '../types'

// 第一版 12 種武器；behavior 決定 combat.ts 的模擬方式，加武器多數只要填資料。
export const WEAPONS: WeaponData[] = [
  {
    id: 'pea_gun', name: '豌豆槍', category: 'ranged', behavior: 'projectile',
    description: '穩定的遠程單體射擊，勇者的第一把槍。',
    base: { damage: 8, cooldown: 0.85, range: 380, projectileCount: 1, pierce: 0, knockback: 30, speed: 520 },
    perLevel: { damage: 3, cooldown: -0.06 },
    maxLevel: 4, tags: ['ranged', 'bullet'], price: 12, tier: 1, palette: ['#7bc043', '#4e8a22'],
  },
  {
    id: 'knife', name: '飛刀', category: 'ranged', behavior: 'projectile',
    description: '高攻速、高暴擊的小刀，貼近一點更痛。',
    base: { damage: 5, cooldown: 0.45, range: 300, projectileCount: 1, pierce: 1, knockback: 10, speed: 620 },
    perLevel: { damage: 2, projectileCount: 0.5 },
    maxLevel: 4, critModifier: 2.0, tags: ['ranged', 'crit'], price: 14, tier: 1, palette: ['#cfd8dc', '#78909c'],
  },
  {
    id: 'spin_axe', name: '迴旋斧', category: 'melee', behavior: 'orbit',
    description: '圍繞自己旋轉的斧頭，站進怪堆就是傷害。',
    base: { damage: 10, cooldown: 1.1, range: 0, projectileCount: 1, pierce: 99, knockback: 60, radius: 95, speed: 3.2 },
    perLevel: { damage: 4, projectileCount: 0.5, radius: 8 },
    maxLevel: 4, tags: ['melee', 'orbit'], price: 16, tier: 1, palette: ['#ff9f43', '#b0682a'],
  },
  {
    id: 'hammer', name: '鐵鎚', category: 'melee', behavior: 'melee',
    description: '慢而痛的大鎚，掄一圈把怪拍飛。',
    base: { damage: 22, cooldown: 1.6, range: 120, projectileCount: 1, pierce: 99, knockback: 200, radius: 110 },
    perLevel: { damage: 8, radius: 8, knockback: 20 },
    maxLevel: 4, tags: ['melee', 'knockback'], price: 18, tier: 1, palette: ['#90a4ae', '#546e7a'],
  },
  {
    id: 'fireball', name: '火球', category: 'magic', behavior: 'projectile',
    description: '命中後爆炸的火球，範圍傷害的基石。',
    base: { damage: 14, cooldown: 1.5, range: 360, projectileCount: 1, pierce: 0, knockback: 60, speed: 420, radius: 80 },
    perLevel: { damage: 5, radius: 10 },
    maxLevel: 4, specialEffect: 'explode', tags: ['magic', 'explosive'], price: 20, tier: 2, palette: ['#ff6b35', '#c9302c'],
  },
  {
    id: 'ice_shard', name: '冰刺', category: 'magic', behavior: 'projectile',
    description: '傷害不高，但能凍住敵人的腳。',
    base: { damage: 6, cooldown: 0.9, range: 340, projectileCount: 1, pierce: 1, knockback: 20, speed: 480, slow: 0.4, duration: 2, freezeChance: 0.08 },
    perLevel: { damage: 2, slow: 0.05, freezeChance: 0.02 },
    maxLevel: 4, tags: ['magic', 'frost'], price: 16, tier: 1, palette: ['#a8e0ff', '#4fa8d8'],
  },
  {
    id: 'lightning', name: '閃電鏈', category: 'magic', behavior: 'chain',
    description: '在敵人之間跳躍的電弧。',
    base: { damage: 9, cooldown: 1.4, range: 320, projectileCount: 1, pierce: 0, knockback: 0, chains: 3, radius: 160 },
    perLevel: { damage: 3, chains: 1 },
    maxLevel: 4, tags: ['magic', 'lightning'], price: 22, tier: 2, palette: ['#ffe66d', '#f0a500'],
  },
  {
    id: 'mine', name: '地雷', category: 'engineer', behavior: 'mine',
    description: '定時在腳邊佈雷，踩到就炸。',
    base: { damage: 26, cooldown: 2.4, range: 90, projectileCount: 1, pierce: 99, knockback: 120, radius: 100, duration: 12 },
    perLevel: { damage: 9, cooldown: -0.25 },
    maxLevel: 4, specialEffect: 'explode', tags: ['engineer', 'explosive'], price: 18, tier: 2, palette: ['#8a6d3b', '#ffcf5c'],
  },
  {
    id: 'turret_gun', name: '砲塔', category: 'engineer', behavior: 'turret',
    description: '召喚自動攻擊的迷你砲塔（同時最多 2 座）。',
    base: { damage: 6, cooldown: 6.5, range: 300, projectileCount: 1, pierce: 0, knockback: 20, speed: 520, duration: 8 },
    perLevel: { damage: 2, duration: 1.5 },
    maxLevel: 4, tags: ['engineer', 'summon'], price: 24, tier: 2, palette: ['#b0bec5', '#607d8b'],
  },
  {
    id: 'heal_orb', name: '治療球', category: 'support', behavior: 'healPulse',
    description: '週期性治療自己與最傷的隊友。',
    base: { damage: 0, cooldown: 4.5, range: 260, projectileCount: 1, pierce: 0, knockback: 0, heal: 8 },
    perLevel: { heal: 3, cooldown: -0.4 },
    maxLevel: 4, tags: ['support', 'heal'], price: 20, tier: 2, palette: ['#7bd88f', '#3aa65c'],
  },
  {
    id: 'poison_flask', name: '毒霧瓶', category: 'magic', behavior: 'zone',
    description: '往怪堆丟出毒瓶，留下持續傷害的毒霧。',
    base: { damage: 4, cooldown: 2.6, range: 320, projectileCount: 1, pierce: 0, knockback: 0, radius: 110, duration: 4, burn: 6 },
    perLevel: { burn: 2.5, radius: 10 },
    maxLevel: 4, tags: ['magic', 'poison', 'zone'], price: 20, tier: 2, palette: ['#9ccc65', '#558b2f'],
  },
  {
    id: 'drone', name: '無人機', category: 'summon', behavior: 'drone',
    description: '跟著你飛的小飛機，自動掃射附近敵人。',
    base: { damage: 5, cooldown: 0.7, range: 300, projectileCount: 1, pierce: 0, knockback: 10, speed: 560 },
    perLevel: { damage: 2, cooldown: -0.05 },
    maxLevel: 4, tags: ['summon', 'bullet'], price: 22, tier: 2, palette: ['#4fc3f7', '#0288d1'],
  },
]

export const WEAPON_MAP = new Map(WEAPONS.map(w => [w.id, w]))

/** 武器等級後的實際數值（perLevel 為加法） */
export function weaponStatsAt(w: WeaponData, level: number) {
  const s = { ...w.base }
  const lv = Math.min(level, w.maxLevel) - 1
  for (const [k, v] of Object.entries(w.perLevel)) {
    const key = k as keyof typeof s
    // projectileCount 之類的半數增量向下取整
    const val = (s[key] ?? 0) + (v as number) * lv
    ;(s as Record<string, number>)[key] = key === 'projectileCount' ? Math.floor(val) : val
  }
  s.cooldown = Math.max(0.15, s.cooldown)
  return s
}
