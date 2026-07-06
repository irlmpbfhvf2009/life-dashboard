import type { ItemData, ChestRewardData } from '../types'

// 10 種臨時掉落道具（撿到立即生效；effect 由 server drops.ts 實作）。
export const ITEMS: ItemData[] = [
  { id: 'magnet', name: '磁鐵', emoji: '🧲', description: '吸取全場掉落物', effect: 'magnetAll', weight: 10 },
  { id: 'bomb', name: '炸彈', emoji: '💣', description: '清除附近小怪', effect: 'clearBomb', params: { radius: 260, damage: 60 }, weight: 10 },
  { id: 'shield', name: '護盾', emoji: '🛡️', description: '短暫無敵 3 秒', effect: 'invuln', params: { duration: 3 }, weight: 8 },
  { id: 'haste', name: '加速藥水', emoji: '⚡', description: '移動速度 +40%，持續 6 秒', effect: 'hasteBuff', params: { duration: 6, amount: 0.4 }, weight: 10 },
  { id: 'rage', name: '狂暴藥水', emoji: '🔥', description: '攻速 +50%，持續 6 秒', effect: 'rageBuff', params: { duration: 6, amount: 0.5 }, weight: 10 },
  { id: 'freeze', name: '冰凍球', emoji: '❄️', description: '凍結附近敵人 2.5 秒', effect: 'freezeNearby', params: { radius: 280, duration: 2.5 }, weight: 8 },
  { id: 'energy', name: '技能球', emoji: '🔮', description: '主動技能冷卻 -50%', effect: 'skillCd', params: { amount: 0.5 }, weight: 8 },
  { id: 'key', name: '寶箱鑰匙', emoji: '🗝️', description: '本波寶箱獎勵 +1 選項', effect: 'chestKey', weight: 5 },
  { id: 'coinbag', name: '金幣袋', emoji: '💰', description: '立即獲得金幣', effect: 'instantGold', params: { min: 8, max: 18 }, weight: 10 },
  { id: 'medkit', name: '急救包', emoji: '💊', description: '立即回復 40% 生命', effect: 'instantHeal', params: { pct: 0.4 }, weight: 9 },
]

export const ITEM_MAP = new Map(ITEMS.map(i => [i.id, i]))

// 5 種寶箱獎勵類型（開箱時擲出其中一種，玩家從選項中挑）。
export const CHEST_REWARDS: ChestRewardData[] = [
  { id: 'cr_gold', name: '高額金幣', type: 'gold', weight: 25 },
  { id: 'cr_weapon', name: '隨機武器', type: 'weapon', weight: 22 },
  { id: 'cr_upgrade', name: '稀有升級', type: 'upgrade', weight: 28 },
  { id: 'cr_shard', name: '復活碎片', type: 'reviveShard', weight: 10 },
  { id: 'cr_curse', name: '詛咒升級（高風險高報酬）', type: 'curse', weight: 15 },
]
