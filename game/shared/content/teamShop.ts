import type { TeamShopItemData } from '../types'

// 團隊商店道具 — 多數決投票購買（單人直接買），花的是全隊分攤（各扣 price/人數，無條件進位）。
export const TEAM_SHOP_ITEMS: TeamShopItemData[] = [
  { id: 'ts_heal', name: '全隊回血', description: '立即全隊回復 35% 生命', price: 18, effect: 'teamHealPct', params: { pct: 0.35 } },
  { id: 'ts_shield', name: '開場護盾', description: '下一波開場全隊獲得 40 護盾', price: 22, effect: 'nextWaveShield', params: { amount: 40 } },
  { id: 'ts_revive', name: '團隊復活 +1', description: '購買一次團隊復活', price: 30, effect: 'buyRevive', once: false },
  { id: 'ts_bossdmg', name: '屠龍磨刀石', description: '對 Boss 傷害 +10%（永久）', price: 32, effect: 'bossDamage', params: { amount: 0.1 } },
  { id: 'ts_objhp', name: '加固工事', description: '任務目標（水晶/推車/糧倉）生命 +20%（永久）', price: 18, effect: 'objectiveHp', params: { amount: 0.2 } },
  { id: 'ts_discount', name: '團購券', description: '下一輪商店全隊 8 折', price: 15, effect: 'nextShopDiscount', params: { amount: 0.2 } },
  { id: 'ts_droprate', name: '豐收肥料', description: '下一波掉落 +40%', price: 15, effect: 'nextWaveDropBoost', params: { mult: 1.4 } },
]

export const TEAM_SHOP_MAP = new Map(TEAM_SHOP_ITEMS.map(t => [t.id, t]))
