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
// 2026-07 大擴充：池子變「雜」——輸出/防禦/回復/功能/賭博混在一起，
// 開箱可能整排都不是你要的（不再保證天胡）；shiny=true 的高價值選項權重乘幸運。
export const CHEST_BOONS: ChestBoonData[] = [
  // ---- 輸出（權重再下修；單顆數值上調——寶箱變少但每顆更有份量）
  { id: 'boon_dmg', name: '力量果實', detail: '傷害 +20%（永久）', weight: 9, statMods: { damage: 0.2 } },
  { id: 'boon_atk', name: '疾風之葉', detail: '攻擊速度 +15%（永久）', weight: 8, statMods: { attackSpeed: 0.15 } },
  { id: 'boon_crit', name: '銳眼之種', detail: '暴擊率 +10%（永久）', weight: 7, statMods: { critChance: 0.1 } },
  { id: 'boon_critd', name: '致命棘刺', detail: '暴擊傷害 +45%（永久）', weight: 7, statMods: { critDamage: 0.45 } },
  { id: 'boon_area', name: '沃土擴張', detail: '範圍效果 +20%（永久）', weight: 8, statMods: { area: 0.2 } },
  { id: 'boon_proj', name: '分裂胚芽', detail: '投射物 +1（永久）', weight: 4, statMods: { projectiles: 1 }, shiny: true },
  { id: 'boon_pierce', name: '貫穿尖芽', detail: '穿透 +1（永久）', weight: 5, statMods: { pierce: 1 } },
  // ---- 防禦 / 生存
  { id: 'boon_hp', name: '巨壯塊莖', detail: '最大生命 +45（永久）', weight: 10, statMods: { maxHp: 45 } },
  { id: 'boon_armor', name: '硬化樹皮', detail: '護甲 +3（永久）', weight: 9, statMods: { armor: 3 } },
  { id: 'boon_dodge', name: '疾影披風', detail: '迴避 +10%（永久，上限 70%）', weight: 8, statMods: { dodge: 0.1 } },
  { id: 'boon_shield', name: '甲殼共生', detail: '每波開場護盾 +30（永久）', weight: 8, effect: 'waveShield', params: { amount: 30 } },
  { id: 'boon_life', name: '汲血菌絲', detail: '擊殺回復 +3 生命（永久）', weight: 8, statMods: { lifeOnKill: 3 } },
  { id: 'boon_regen', name: '光合強化', detail: '每秒回復 +2（永久）', weight: 8, statMods: { regen: 2 } },
  // ---- 功能 / 經濟（幸運・金幣・經驗 build 的糧食）
  { id: 'boon_spd', name: '風行根鬚', detail: '移動速度 +10%（永久）', weight: 8, statMods: { moveSpeed: 0.1 } },
  { id: 'boon_goldpct', name: '生財之葉', detail: '金幣獲得 +30%（永久）', weight: 9, statMods: { goldGain: 0.3 } },
  { id: 'boon_xppct', name: '智慧年輪', detail: '經驗獲得 +30%（永久）', weight: 9, statMods: { xpGain: 0.3 } },
  { id: 'boon_luck', name: '幸運瓢蟲', detail: '幸運 +25%（稀有度/掉落判定，永久）', weight: 8, statMods: { luck: 0.25 } },
  { id: 'boon_pick', name: '藤蔓觸手', detail: '拾取範圍 +70（永久）', weight: 6, statMods: { pickupRange: 70 } },
  // ---- 取捨（有得有失——開箱要思考 build，不是無腦點輸出）
  { id: 'boon_t_rage', name: '血怒菌株', detail: '傷害 +35%，但最大生命 -25', weight: 9, statMods: { damage: 0.35, maxHp: -25 } },
  { id: 'boon_t_heavy', name: '重錘孢子', detail: '傷害 +40%，但攻擊速度 -15%', weight: 9, statMods: { damage: 0.4, attackSpeed: -0.15 } },
  { id: 'boon_t_light', name: '狂熱花粉', detail: '攻擊速度 +30%，但傷害 -15%', weight: 9, statMods: { attackSpeed: 0.3, damage: -0.15 } },
  { id: 'boon_t_focus', name: '聚焦稜鏡', detail: '傷害 +35%，但範圍效果 -20%', weight: 9, statMods: { damage: 0.35, area: -0.2 } },
  { id: 'boon_t_wide', name: '廣域菌網', detail: '範圍效果 +35%，但傷害 -15%', weight: 9, statMods: { area: 0.35, damage: -0.15 } },
  { id: 'boon_t_wall', name: '鐵壁樹瘤', detail: '護甲 +4，但移動速度 -10%', weight: 8, statMods: { armor: 4, moveSpeed: -0.1 } },
  { id: 'boon_t_greed', name: '掠奪本能', detail: '金幣獲得 +50%，但最大生命 -20', weight: 8, statMods: { goldGain: 0.5, maxHp: -20 } },
  // ---- 乘算/技能/特殊（爆發 build 的核心；shiny → 幸運加權）
  { id: 'boon_dmgx', name: '狂暴基因', detail: '傷害 ×1.35（乘算，可疊）', weight: 6, effect: 'dmgMult', params: { mult: 1.35 }, shiny: true },
  { id: 'boon_skill', name: '奧義精髓', detail: '主動技能傷害 +35%（永久）', weight: 8, effect: 'skillPower' },
  { id: 'boon_skillcd', name: '靜心冥想', detail: '技能冷卻 -10%（永久）', weight: 7, effect: 'skillCd' },
  { id: 'boon_weaponup', name: '武器精鍊', detail: '隨機一把武器 +1 級', weight: 10, effect: 'weaponUp' },
  { id: 'boon_allweaponup', name: '全軍突擊', detail: '所有武器 +1 級！', weight: 3, effect: 'allWeaponUp', shiny: true },
  { id: 'boon_upgrade', name: '神秘天賦', detail: '獲得一個隨機史詩升級', weight: 7, effect: 'epicUpgrade', shiny: true },
  { id: 'boon_gold', name: '高額金幣', detail: '立即獲得大筆金幣', weight: 8, effect: 'gold' },
  { id: 'boon_curse', name: '詛咒契約', detail: '隨機詛咒（高風險高報酬）', weight: 7, effect: 'curse' },
]

// 首領寶箱（每 5 波 Boss 必掉）：不三選一、直接隨機抽一個超大獎——攻擊/防禦/回復/輔助
// 都可能，賭的就是心跳。每個存活玩家各自抽一次（server drops.ts / shop.ts bossChestDraw）。
export const BOSS_BOONS: ChestBoonData[] = [
  // 攻擊
  { id: 'bb_dmgx', name: '滅世孢子', detail: '傷害 ×1.5（乘算）', weight: 8, effect: 'dmgMult', params: { mult: 1.5 } },
  { id: 'bb_allweapon', name: '軍火盛宴', detail: '所有武器 +2 級！', weight: 8, effect: 'allWeaponUp', params: { levels: 2 } },
  { id: 'bb_crit', name: '獵殺本能', detail: '暴擊率 +15%＆暴擊傷害 +60%', weight: 8, statMods: { critChance: 0.15, critDamage: 0.6 } },
  { id: 'bb_proj', name: '瘋狂增殖', detail: '投射物 +1＆傷害 +15%', weight: 7, statMods: { projectiles: 1, damage: 0.15 } },
  // 防禦
  { id: 'bb_tank', name: '鋼鐵菜心', detail: '護甲 +4＆最大生命 +80', weight: 8, statMods: { armor: 4, maxHp: 80 } },
  { id: 'bb_shield', name: '聖盾祝福', detail: '每波開場護盾 +50（永久）', weight: 8, effect: 'waveShield', params: { amount: 50 } },
  // 回復
  { id: 'bb_regen', name: '生命之泉', detail: '每秒回復 +4＆擊殺回復 +3', weight: 8, statMods: { regen: 4, lifeOnKill: 3 } },
  { id: 'bb_heal', name: '女神的擁抱', detail: '全體立即回滿＆最大生命 +50', weight: 7, effect: 'fullHeal', params: { hp: 50 } },
  // 輔助 / 功能
  { id: 'bb_skill', name: '奧義覺醒', detail: '技能傷害 +70%＆技能冷卻 -10%', weight: 8, effect: 'skillBoost' },
  { id: 'bb_speed', name: '疾風祝福', detail: '移動速度 +12%＆拾取範圍 +80', weight: 7, statMods: { moveSpeed: 0.12, pickupRange: 80 } },
  { id: 'bb_rich', name: '黃金雨', detail: '金幣獲得 +50%＆立即一大筆金幣', weight: 7, effect: 'richGold' },
  { id: 'bb_lucky', name: '命運眷顧', detail: '幸運 +35%＆經驗獲得 +35%', weight: 7, statMods: { luck: 0.35, xpGain: 0.35 } },
]
