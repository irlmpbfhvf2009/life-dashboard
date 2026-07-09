import type { ItemData, ChestBoonData } from '../types'

// 10 種臨時掉落道具（撿到立即生效；effect 由 server drops.ts 實作）。
export const ITEMS: ItemData[] = [
  { id: 'magnet', name: '磁鐵', emoji: '🧲', description: '吸取全場掉落物', effect: 'magnetAll', weight: 10 },
  { id: 'bomb', name: '炸彈', emoji: '💣', description: '清除附近小怪', effect: 'clearBomb', params: { radius: 260, damage: 60 }, weight: 10 },
  { id: 'shield', name: '護盾', emoji: '🛡️', description: '短暫無敵 3 秒', effect: 'invuln', params: { duration: 3 }, weight: 8 },
  { id: 'haste', name: '加速藥水', emoji: '⚡', description: '移動速度 +40%，持續 6 秒', effect: 'hasteBuff', params: { duration: 6, amount: 0.4 }, weight: 10 },
  { id: 'rage', name: '狂暴藥水', emoji: '🔥', description: '攻速 +50%，持續 6 秒', effect: 'rageBuff', params: { duration: 6, amount: 0.5 }, weight: 10 },
  { id: 'freeze', name: '冰凍球', emoji: '❄️', description: '凍結附近敵人 2.5 秒', effect: 'freezeNearby', params: { radius: 280, duration: 2.5 }, weight: 8 },
  { id: 'energy', name: '技能球', emoji: '🔮', description: '主動技能冷卻 -50%', effect: 'skillCd', params: { amount: 0.5 }, weight: 8 },
  { id: 'key', name: '寶箱鑰匙', emoji: '🗝️', description: '下次開寶箱時多 1 個選項可挑', effect: 'chestKey', weight: 5 },
  { id: 'coinbag', name: '金幣袋', emoji: '💰', description: '立即獲得金幣', effect: 'instantGold', params: { min: 8, max: 18 }, weight: 10 },
  { id: 'medkit', name: '急救包', emoji: '💊', description: '立即回復 40% 生命', effect: 'instantHeal', params: { pct: 0.4 }, weight: 9 },
]

export const ITEM_MAP = new Map(ITEMS.map(i => [i.id, i]))

// 寶箱 boon 池（開箱三選一，全部是「永久戰力」——這是 build 成形/傷害滾雪球的主要來源）。
// 武器改由商店購買、復活碎片已移除。加 boon = 加一筆資料。
export const CHEST_BOONS: ChestBoonData[] = [
  // ---- 屬性加成（疊加）
  { id: 'boon_dmg', name: '力量果實', detail: '傷害 +15%（永久）', weight: 20, statMods: { damage: 0.15 } },
  { id: 'boon_atk', name: '疾風之葉', detail: '攻擊速度 +12%（永久）', weight: 16, statMods: { attackSpeed: 0.12 } },
  { id: 'boon_spd', name: '風行根鬚', detail: '移動速度 +8%（永久）', weight: 10, statMods: { moveSpeed: 0.08 } },
  { id: 'boon_hp', name: '巨壯塊莖', detail: '最大生命 +30（永久）', weight: 12, statMods: { maxHp: 30 } },
  { id: 'boon_crit', name: '銳眼之種', detail: '暴擊率 +8%（永久）', weight: 12, statMods: { critChance: 0.08 } },
  { id: 'boon_critd', name: '致命棘刺', detail: '暴擊傷害 +35%（永久）', weight: 12, statMods: { critDamage: 0.35 } },
  { id: 'boon_area', name: '沃土擴張', detail: '範圍效果 +15%（永久）', weight: 10, statMods: { area: 0.15 } },
  { id: 'boon_proj', name: '分裂胚芽', detail: '投射物 +1（永久）', weight: 4, statMods: { projectiles: 1 } },
  { id: 'boon_pierce', name: '貫穿尖芽', detail: '穿透 +1（永久）', weight: 6, statMods: { pierce: 1 } },
  { id: 'boon_life', name: '汲血菌絲', detail: '擊殺回復 +2 生命（永久）', weight: 8, statMods: { lifeOnKill: 2 } },
  { id: 'boon_regen', name: '光合強化', detail: '每秒回復 +1.5（永久）', weight: 8, statMods: { regen: 1.5 } },
  // ---- 乘算/技能/特殊（爆發 build 的核心）
  { id: 'boon_dmgx', name: '狂暴基因', detail: '傷害 ×1.3（乘算，可疊）', weight: 6, effect: 'dmgMult', params: { mult: 1.3 } },
  { id: 'boon_skill', name: '奧義精髓', detail: '主動技能傷害 +35%（永久）', weight: 10, effect: 'skillPower' },
  { id: 'boon_skillcd', name: '靜心冥想', detail: '技能冷卻 -10%（永久）', weight: 8, effect: 'skillCd' },
  { id: 'boon_weaponup', name: '武器精鍊', detail: '隨機一把武器 +1 級', weight: 14, effect: 'weaponUp' },
  { id: 'boon_allweaponup', name: '全軍突擊', detail: '所有武器 +1 級！', weight: 3, effect: 'allWeaponUp' },
  { id: 'boon_upgrade', name: '神秘天賦', detail: '獲得一個隨機史詩升級', weight: 8, effect: 'epicUpgrade' },
  { id: 'boon_gold', name: '高額金幣', detail: '立即獲得大筆金幣', weight: 10, effect: 'gold' },
  { id: 'boon_curse', name: '詛咒契約', detail: '隨機詛咒（高風險高報酬）', weight: 8, effect: 'curse' },
]
