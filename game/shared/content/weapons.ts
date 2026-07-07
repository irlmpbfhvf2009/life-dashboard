import type { WeaponData } from '../types'

// 武器系統：每個角色 5 把「專屬武器」（charId 標記）。開局從自己的 5 把選 1，
// 其餘靠商店/升級/寶箱取得。behavior 決定 combat.ts 的模擬方式，加武器多數只要填資料。
// 商店只會出現「當前角色的專屬武器」＋共通道具（升級/消耗品）。
export const WEAPONS: WeaponData[] = [
  // ============================================================ 戰士地瓜（冷兵器）
  {
    id: 'w_sword', name: '劍與盾', category: 'melee', behavior: 'melee', charId: 'warrior_sweetpotato',
    description: '一劍揮出半月，穩健的近戰主力。',
    base: { damage: 16, cooldown: 0.9, range: 110, projectileCount: 1, pierce: 99, knockback: 120, radius: 100 },
    perLevel: { damage: 6, radius: 8, knockback: 15 },
    maxLevel: 5, tags: ['melee'], price: 12, tier: 1, palette: ['#d7dde2', '#8d99a6'],
  },
  {
    id: 'w_greatsword', name: '雙手大劍', category: 'melee', behavior: 'melee', charId: 'warrior_sweetpotato',
    description: '慢而沉重的巨劍，一掃一大片。',
    base: { damage: 30, cooldown: 1.7, range: 140, projectileCount: 1, pierce: 99, knockback: 160, radius: 135 },
    perLevel: { damage: 11, radius: 10 },
    maxLevel: 5, tags: ['melee', 'heavy'], price: 20, tier: 2, palette: ['#b0bec5', '#546e7a'],
  },
  {
    id: 'w_spear', name: '長槍', category: 'melee', behavior: 'projectile', charId: 'warrior_sweetpotato',
    description: '向前突刺的長槍，貫穿成排的敵人。',
    base: { damage: 14, cooldown: 0.8, range: 260, projectileCount: 1, pierce: 4, knockback: 60, speed: 640 },
    perLevel: { damage: 5, pierce: 1 },
    maxLevel: 5, tags: ['melee', 'pierce'], price: 16, tier: 2, palette: ['#cfd8dc', '#8d6e63'],
  },
  {
    id: 'spin_axe', name: '迴旋斧', category: 'melee', behavior: 'orbit', charId: 'warrior_sweetpotato',
    description: '圍繞自己旋轉的斧頭，站進怪堆就是傷害。',
    base: { damage: 10, cooldown: 1.1, range: 0, projectileCount: 1, pierce: 99, knockback: 60, radius: 95, speed: 3.2 },
    perLevel: { damage: 4, projectileCount: 0.5, radius: 8 },
    maxLevel: 5, tags: ['melee', 'orbit'], price: 16, tier: 1, palette: ['#ff9f43', '#b0682a'],
  },
  {
    id: 'hammer', name: '戰鎚', category: 'melee', behavior: 'melee', charId: 'warrior_sweetpotato',
    description: '慢而痛的大鎚，掄一圈把怪拍飛。',
    base: { damage: 24, cooldown: 1.6, range: 120, projectileCount: 1, pierce: 99, knockback: 220, radius: 110 },
    perLevel: { damage: 9, radius: 8, knockback: 20 },
    maxLevel: 5, tags: ['melee', 'knockback'], price: 18, tier: 2, palette: ['#90a4ae', '#546e7a'],
  },

  // ============================================================ 槍手馬鈴薯（槍械）
  {
    id: 'pea_gun', name: '手槍', category: 'ranged', behavior: 'projectile', charId: 'gunner_potato',
    description: '穩定的半自動手槍，勇者的第一把槍。',
    base: { damage: 8, cooldown: 0.7, range: 400, projectileCount: 1, pierce: 0, knockback: 30, speed: 560 },
    perLevel: { damage: 3, cooldown: -0.05 },
    maxLevel: 5, tags: ['ranged', 'bullet'], price: 12, tier: 1, palette: ['#7bc043', '#4e8a22'],
  },
  {
    id: 'g_sniper', name: '狙擊槍', category: 'ranged', behavior: 'projectile', charId: 'gunner_potato',
    description: '慢速高傷、貫穿一整列的狙擊。',
    base: { damage: 34, cooldown: 1.8, range: 620, projectileCount: 1, pierce: 5, knockback: 90, speed: 1100 },
    perLevel: { damage: 13, pierce: 1 },
    maxLevel: 5, critModifier: 1.8, tags: ['ranged', 'sniper', 'crit'], price: 22, tier: 2, palette: ['#455a64', '#cfd8dc'],
  },
  {
    id: 'g_shotgun', name: '霰彈槍', category: 'ranged', behavior: 'projectile', charId: 'gunner_potato',
    description: '一次噴出一扇散彈，近距離毀滅。',
    base: { damage: 6, cooldown: 1.0, range: 240, projectileCount: 5, pierce: 0, knockback: 70, speed: 520 },
    perLevel: { damage: 2, projectileCount: 1 },
    maxLevel: 5, tags: ['ranged', 'spread'], price: 20, tier: 2, palette: ['#a1887f', '#5d4037'],
  },
  {
    id: 'g_smg', name: '衝鋒槍', category: 'ranged', behavior: 'projectile', charId: 'gunner_potato',
    description: '極高射速的傾瀉火力，單發不痛但很密。',
    base: { damage: 4, cooldown: 0.28, range: 360, projectileCount: 1, pierce: 0, knockback: 12, speed: 640 },
    perLevel: { damage: 1.5, cooldown: -0.02 },
    maxLevel: 5, tags: ['ranged', 'bullet', 'rapid'], price: 18, tier: 2, palette: ['#78909c', '#37474f'],
  },
  {
    id: 'g_minigun', name: '加特林', category: 'ranged', behavior: 'projectile', charId: 'gunner_potato',
    description: '六管轉輪連射，彈幕淹沒戰場。',
    base: { damage: 5, cooldown: 0.2, range: 380, projectileCount: 1, pierce: 1, knockback: 15, speed: 680 },
    perLevel: { damage: 2, projectileCount: 0.34 },
    maxLevel: 5, tags: ['ranged', 'bullet', 'rapid'], price: 26, tier: 3, palette: ['#ffca28', '#f57f17'],
  },

  // ============================================================ 醫生蘿蔔（治療 + 生化）
  {
    id: 'heal_orb', name: '治療球', category: 'support', behavior: 'healPulse', charId: 'medic_radish',
    description: '週期性治療自己與最傷的隊友，並灼傷周圍敵人。',
    base: { damage: 0, cooldown: 4.0, range: 260, projectileCount: 1, pierce: 0, knockback: 0, heal: 9 },
    perLevel: { heal: 3, cooldown: -0.35 },
    maxLevel: 5, tags: ['support', 'heal'], price: 16, tier: 1, palette: ['#7bd88f', '#3aa65c'],
  },
  {
    id: 'm_needle', name: '針筒槍', category: 'support', behavior: 'projectile', charId: 'medic_radish',
    description: '發射高速針劑，扎穿敵人。',
    base: { damage: 9, cooldown: 0.6, range: 380, projectileCount: 1, pierce: 1, knockback: 15, speed: 620 },
    perLevel: { damage: 3, pierce: 0.5 },
    maxLevel: 5, tags: ['support', 'bullet'], price: 14, tier: 1, palette: ['#e57373', '#c62828'],
  },
  {
    id: 'm_cross', name: '十字回力鏢', category: 'support', behavior: 'orbit', charId: 'medic_radish',
    description: '繞身旋轉的十字醫療鏢。',
    base: { damage: 11, cooldown: 1.1, range: 0, projectileCount: 1, pierce: 99, knockback: 40, radius: 100, speed: 3.4 },
    perLevel: { damage: 4, projectileCount: 0.5, radius: 8 },
    maxLevel: 5, tags: ['support', 'orbit'], price: 18, tier: 2, palette: ['#ef5350', '#fff'],
  },
  {
    id: 'm_biozone', name: '消毒領域', category: 'support', behavior: 'zone', charId: 'medic_radish',
    description: '灑出消毒藥霧，持續灼傷站在裡面的敵人。',
    base: { damage: 4, cooldown: 2.4, range: 300, projectileCount: 1, pierce: 0, knockback: 0, radius: 120, duration: 4, burn: 7 },
    perLevel: { burn: 2.5, radius: 10 },
    maxLevel: 5, tags: ['support', 'zone'], price: 20, tier: 2, palette: ['#80deea', '#00838f'],
  },
  {
    id: 'm_drone', name: '醫療無人機', category: 'support', behavior: 'drone', charId: 'medic_radish',
    description: '跟著你飛的小飛機，掃射附近敵人。',
    base: { damage: 6, cooldown: 0.7, range: 300, projectileCount: 1, pierce: 0, knockback: 10, speed: 560 },
    perLevel: { damage: 2, cooldown: -0.05 },
    maxLevel: 5, tags: ['support', 'summon'], price: 22, tier: 2, palette: ['#b39ddb', '#5e35b1'],
  },

  // ============================================================ 工程洋蔥（部署系）
  {
    id: 'turret_gun', name: '自動砲塔', category: 'engineer', behavior: 'turret', charId: 'engineer_onion',
    description: '佈署自動攻擊的迷你砲塔。',
    base: { damage: 7, cooldown: 6.0, range: 320, projectileCount: 1, pierce: 0, knockback: 20, speed: 540, duration: 9 },
    perLevel: { damage: 2.5, duration: 1.5 },
    maxLevel: 5, tags: ['engineer', 'summon'], price: 22, tier: 2, palette: ['#b0bec5', '#607d8b'],
  },
  {
    id: 'mine', name: '地雷', category: 'engineer', behavior: 'mine', charId: 'engineer_onion',
    description: '定時在腳邊佈雷，踩到就炸。',
    base: { damage: 26, cooldown: 2.2, range: 90, projectileCount: 1, pierce: 99, knockback: 120, radius: 100, duration: 12 },
    perLevel: { damage: 9, cooldown: -0.22 },
    maxLevel: 5, specialEffect: 'explode', tags: ['engineer', 'explosive'], price: 16, tier: 1, palette: ['#8a6d3b', '#ffcf5c'],
  },
  {
    id: 'drone', name: '工程無人機', category: 'engineer', behavior: 'drone', charId: 'engineer_onion',
    description: '跟著你飛的小飛機，自動掃射附近敵人。',
    base: { damage: 5, cooldown: 0.7, range: 300, projectileCount: 1, pierce: 0, knockback: 10, speed: 560 },
    perLevel: { damage: 2, cooldown: -0.05 },
    maxLevel: 5, tags: ['engineer', 'summon'], price: 20, tier: 2, palette: ['#4fc3f7', '#0288d1'],
  },
  {
    id: 'e_laser', name: '雷射柵欄', category: 'engineer', behavior: 'zone', charId: 'engineer_onion',
    description: '在敵群中架起灼熱的雷射網。',
    base: { damage: 5, cooldown: 2.6, range: 320, projectileCount: 1, pierce: 0, knockback: 0, radius: 115, duration: 4, burn: 9 },
    perLevel: { burn: 3, radius: 8 },
    maxLevel: 5, tags: ['engineer', 'zone'], price: 22, tier: 2, palette: ['#ff5252', '#b71c1c'],
  },
  {
    id: 'e_flame', name: '火焰噴射器', category: 'engineer', behavior: 'projectile', charId: 'engineer_onion',
    description: '近距離噴出高速火舌，密集灼燒。',
    base: { damage: 6, cooldown: 0.25, range: 200, projectileCount: 1, pierce: 2, knockback: 8, speed: 440, radius: 30 },
    perLevel: { damage: 2, pierce: 0.5 },
    maxLevel: 5, specialEffect: 'explode', tags: ['engineer', 'fire'], price: 24, tier: 3, palette: ['#ff7043', '#e64a19'],
  },

  // ============================================================ 冰法番薯（魔法）
  {
    id: 'ice_shard', name: '冰刺', category: 'magic', behavior: 'projectile', charId: 'mage_yam',
    description: '傷害不高，但能凍住敵人的腳。',
    base: { damage: 6, cooldown: 0.85, range: 360, projectileCount: 1, pierce: 1, knockback: 20, speed: 500, slow: 0.4, duration: 2, freezeChance: 0.1 },
    perLevel: { damage: 2, slow: 0.05, freezeChance: 0.02 },
    maxLevel: 5, tags: ['magic', 'frost'], price: 14, tier: 1, palette: ['#a8e0ff', '#4fa8d8'],
  },
  {
    id: 'fireball', name: '火球', category: 'magic', behavior: 'projectile', charId: 'mage_yam',
    description: '命中後爆炸的火球，範圍傷害的基石。',
    base: { damage: 14, cooldown: 1.4, range: 380, projectileCount: 1, pierce: 0, knockback: 60, speed: 440, radius: 85 },
    perLevel: { damage: 5, radius: 10 },
    maxLevel: 5, specialEffect: 'explode', tags: ['magic', 'explosive'], price: 20, tier: 2, palette: ['#ff6b35', '#c9302c'],
  },
  {
    id: 'lightning', name: '閃電鏈', category: 'magic', behavior: 'chain', charId: 'mage_yam',
    description: '在敵人之間跳躍的電弧。',
    base: { damage: 9, cooldown: 1.3, range: 340, projectileCount: 1, pierce: 0, knockback: 0, chains: 3, radius: 170 },
    perLevel: { damage: 3, chains: 1 },
    maxLevel: 5, tags: ['magic', 'lightning'], price: 20, tier: 2, palette: ['#ffe66d', '#f0a500'],
  },
  {
    id: 'y_orb', name: '奧術寒球', category: 'magic', behavior: 'orbit', charId: 'mage_yam',
    description: '繞身旋轉的奧術冰晶。',
    base: { damage: 10, cooldown: 1.1, range: 0, projectileCount: 2, pierce: 99, knockback: 30, radius: 105, speed: 3.0 },
    perLevel: { damage: 4, projectileCount: 0.5, radius: 8 },
    maxLevel: 5, tags: ['magic', 'orbit', 'frost'], price: 22, tier: 2, palette: ['#8f6ad1', '#a8e0ff'],
  },
  {
    id: 'y_frost', name: '冰霜地帶', category: 'magic', behavior: 'zone', charId: 'mage_yam',
    description: '在地面凝出減速灼寒的冰霜區。',
    base: { damage: 4, cooldown: 2.4, range: 320, projectileCount: 1, pierce: 0, knockback: 0, radius: 120, duration: 4, burn: 6 },
    perLevel: { burn: 2.5, radius: 12 },
    maxLevel: 5, tags: ['magic', 'frost', 'zone'], price: 22, tier: 2, palette: ['#4fc3f7', '#01579b'],
  },

  // ============================================================ 賭徒芋頭（幸運）
  {
    id: 't_dice', name: '骰子彈', category: 'magic', behavior: 'projectile', charId: 'gambler_taro',
    description: '擲出骰子彈，傷害忽高忽低但暴擊驚人。',
    base: { damage: 10, cooldown: 0.8, range: 380, projectileCount: 1, pierce: 1, knockback: 30, speed: 560 },
    perLevel: { damage: 4 },
    maxLevel: 5, critModifier: 2.2, tags: ['gamble', 'crit'], price: 14, tier: 1, palette: ['#f5f5f5', '#c62828'],
  },
  {
    id: 't_cards', name: '飛牌扇', category: 'ranged', behavior: 'projectile', charId: 'gambler_taro',
    description: '一次擲出一扇撲克飛牌。',
    base: { damage: 5, cooldown: 0.7, range: 340, projectileCount: 3, pierce: 1, knockback: 10, speed: 600 },
    perLevel: { damage: 2, projectileCount: 0.5 },
    maxLevel: 5, critModifier: 1.6, tags: ['gamble', 'spread'], price: 18, tier: 2, palette: ['#eceff1', '#212121'],
  },
  {
    id: 't_coin', name: '金幣槍', category: 'ranged', behavior: 'projectile', charId: 'gambler_taro',
    description: '射出金幣，擊殺時偶爾迸出額外金幣。',
    base: { damage: 11, cooldown: 0.9, range: 380, projectileCount: 1, pierce: 0, knockback: 40, speed: 560 },
    perLevel: { damage: 4 },
    maxLevel: 5, specialEffect: 'coinKill', tags: ['gamble', 'gold'], price: 20, tier: 2, palette: ['#ffd54f', '#b8860b'],
  },
  {
    id: 't_orbit', name: '幸運輪', category: 'magic', behavior: 'orbit', charId: 'gambler_taro',
    description: '繞身旋轉的幸運符，暴擊率超高。',
    base: { damage: 9, cooldown: 1.1, range: 0, projectileCount: 2, pierce: 99, knockback: 40, radius: 100, speed: 3.6 },
    perLevel: { damage: 4, projectileCount: 0.5, radius: 8 },
    maxLevel: 5, critModifier: 1.8, tags: ['gamble', 'orbit', 'crit'], price: 22, tier: 2, palette: ['#b58fd1', '#7b1fa2'],
  },
  {
    id: 't_roulette', name: '輪盤領域', category: 'magic', behavior: 'zone', charId: 'gambler_taro',
    description: '在地面轉出輪盤，持續傷害圈內敵人。',
    base: { damage: 5, cooldown: 2.5, range: 320, projectileCount: 1, pierce: 0, knockback: 0, radius: 125, duration: 4, burn: 7 },
    perLevel: { burn: 3, radius: 10 },
    maxLevel: 5, tags: ['gamble', 'zone'], price: 22, tier: 2, palette: ['#e0c2f0', '#6a1b9a'],
  },

  // ============================================================ 刺客豆芽（暗器）
  {
    id: 'knife', name: '飛刀', category: 'ranged', behavior: 'projectile', charId: 'assassin_sprout',
    description: '高攻速、高暴擊的小刀。',
    base: { damage: 5, cooldown: 0.4, range: 320, projectileCount: 1, pierce: 1, knockback: 10, speed: 640 },
    perLevel: { damage: 2, projectileCount: 0.5 },
    maxLevel: 5, critModifier: 2.0, tags: ['crit', 'bullet'], price: 12, tier: 1, palette: ['#cfd8dc', '#78909c'],
  },
  {
    id: 'a_fan', name: '飛刀扇', category: 'ranged', behavior: 'projectile', charId: 'assassin_sprout',
    description: '一次擲出一扇飛刀，割裂成排敵人。',
    base: { damage: 5, cooldown: 0.7, range: 320, projectileCount: 4, pierce: 1, knockback: 10, speed: 660 },
    perLevel: { damage: 2, projectileCount: 0.5 },
    maxLevel: 5, critModifier: 1.8, tags: ['crit', 'spread'], price: 20, tier: 2, palette: ['#eceff1', '#607d8b'],
  },
  {
    id: 'a_shuriken', name: '手裏劍環', category: 'ranged', behavior: 'orbit', charId: 'assassin_sprout',
    description: '繞身高速旋轉的手裏劍。',
    base: { damage: 9, cooldown: 0.9, range: 0, projectileCount: 3, pierce: 99, knockback: 20, radius: 95, speed: 4.2 },
    perLevel: { damage: 3, projectileCount: 0.5, radius: 6 },
    maxLevel: 5, critModifier: 1.6, tags: ['crit', 'orbit'], price: 20, tier: 2, palette: ['#b0bec5', '#455a64'],
  },
  {
    id: 'poison_flask', name: '毒菱', category: 'magic', behavior: 'zone', charId: 'assassin_sprout',
    description: '撒出毒菱，留下持續傷害的毒區。',
    base: { damage: 4, cooldown: 2.4, range: 320, projectileCount: 1, pierce: 0, knockback: 0, radius: 110, duration: 4, burn: 7 },
    perLevel: { burn: 3, radius: 10 },
    maxLevel: 5, tags: ['poison', 'zone'], price: 20, tier: 2, palette: ['#9ccc65', '#558b2f'],
  },
  {
    id: 'a_drone', name: '暗殺蜂', category: 'summon', behavior: 'drone', charId: 'assassin_sprout',
    description: '跟著你的暗殺小蜂，自動狙擊敵人。',
    base: { damage: 6, cooldown: 0.6, range: 320, projectileCount: 1, pierce: 0, knockback: 8, speed: 640 },
    perLevel: { damage: 2, cooldown: -0.04 },
    maxLevel: 5, critModifier: 1.5, tags: ['crit', 'summon'], price: 22, tier: 2, palette: ['#7cb342', '#33691e'],
  },

  // ============================================================ 武士番茄（刀術）
  {
    id: 's_iai', name: '居合斬', category: 'melee', behavior: 'melee', charId: 'samurai_tomato',
    description: '瞬間拔刀的半月斬。',
    base: { damage: 20, cooldown: 1.0, range: 130, projectileCount: 1, pierce: 99, knockback: 100, radius: 120 },
    perLevel: { damage: 8, radius: 8 },
    maxLevel: 5, critModifier: 1.7, tags: ['melee', 'crit'], price: 14, tier: 1, palette: ['#e2402f', '#d7dde2'],
  },
  {
    id: 's_katana', name: '刀氣環', category: 'melee', behavior: 'orbit', charId: 'samurai_tomato',
    description: '繞身環繞的刀氣，斬過即傷。',
    base: { damage: 11, cooldown: 1.0, range: 0, projectileCount: 2, pierce: 99, knockback: 40, radius: 105, speed: 3.6 },
    perLevel: { damage: 4, projectileCount: 0.5, radius: 8 },
    maxLevel: 5, critModifier: 1.6, tags: ['melee', 'orbit', 'crit'], price: 20, tier: 2, palette: ['#ef5350', '#eceff1'],
  },
  {
    id: 's_kunai', name: '苦無', category: 'ranged', behavior: 'projectile', charId: 'samurai_tomato',
    description: '擲出的苦無，貫穿敵陣。',
    base: { damage: 10, cooldown: 0.6, range: 360, projectileCount: 1, pierce: 2, knockback: 20, speed: 660 },
    perLevel: { damage: 4, pierce: 0.5 },
    maxLevel: 5, critModifier: 1.6, tags: ['crit', 'pierce'], price: 16, tier: 2, palette: ['#616161', '#212121'],
  },
  {
    id: 's_wave', name: '斬擊波', category: 'melee', behavior: 'projectile', charId: 'samurai_tomato',
    description: '揮刀送出的劍氣波，穿透一整列。',
    base: { damage: 16, cooldown: 1.1, range: 380, projectileCount: 1, pierce: 6, knockback: 50, speed: 560 },
    perLevel: { damage: 6, pierce: 1 },
    maxLevel: 5, critModifier: 1.7, tags: ['melee', 'pierce', 'crit'], price: 22, tier: 3, palette: ['#ff8a80', '#c62828'],
  },
  {
    id: 's_odachi', name: '大太刀', category: 'melee', behavior: 'melee', charId: 'samurai_tomato',
    description: '巨大長刀，一斬橫掃全場。',
    base: { damage: 30, cooldown: 1.6, range: 150, projectileCount: 1, pierce: 99, knockback: 140, radius: 145 },
    perLevel: { damage: 11, radius: 10 },
    maxLevel: 5, critModifier: 1.7, tags: ['melee', 'heavy', 'crit'], price: 22, tier: 3, palette: ['#c62828', '#eceff1'],
  },

  // ============================================================ 反甲仙人掌（荊棘近戰）
  {
    id: 'c_gauntlet', name: '尖刺拳套', category: 'melee', behavior: 'melee', charId: 'cactus_thorns',
    description: '揮出帶刺的拳套，近身連擊。',
    base: { damage: 15, cooldown: 0.8, range: 100, projectileCount: 1, pierce: 99, knockback: 90, radius: 95 },
    perLevel: { damage: 6, radius: 6, knockback: 10 },
    maxLevel: 5, tags: ['melee', 'thorn'], price: 12, tier: 1, palette: ['#4c9a52', '#2f6b34'],
  },
  {
    id: 'c_whip', name: '仙人掌鞭', category: 'melee', behavior: 'orbit', charId: 'cactus_thorns',
    description: '繞身抽打的帶刺長鞭。',
    base: { damage: 11, cooldown: 1.1, range: 0, projectileCount: 1, pierce: 99, knockback: 70, radius: 120, speed: 3.0 },
    perLevel: { damage: 4, projectileCount: 0.5, radius: 10 },
    maxLevel: 5, tags: ['melee', 'orbit', 'thorn'], price: 18, tier: 2, palette: ['#66bb6a', '#1b5e20'],
  },
  {
    id: 'c_shield', name: '荊棘盾', category: 'melee', behavior: 'melee', charId: 'cactus_thorns',
    description: '以帶刺硬殼盾撞，把怪物大力擊飛。',
    base: { damage: 18, cooldown: 1.4, range: 120, projectileCount: 1, pierce: 99, knockback: 240, radius: 110 },
    perLevel: { damage: 7, knockback: 25, radius: 8 },
    maxLevel: 5, tags: ['melee', 'knockback', 'thorn'], price: 20, tier: 2, palette: ['#388e3c', '#8bc34a'],
  },
  {
    id: 'c_spikes', name: '地刺柱', category: 'engineer', behavior: 'zone', charId: 'cactus_thorns',
    description: '從地面刺出尖刺區，持續刺傷敵人。',
    base: { damage: 5, cooldown: 2.4, range: 300, projectileCount: 1, pierce: 0, knockback: 0, radius: 115, duration: 4, burn: 8 },
    perLevel: { burn: 3, radius: 10 },
    maxLevel: 5, tags: ['zone', 'thorn'], price: 20, tier: 2, palette: ['#558b2f', '#33691e'],
  },
  {
    id: 'c_seed', name: '種子散射', category: 'ranged', behavior: 'projectile', charId: 'cactus_thorns',
    description: '噴出一扇帶刺種子。',
    base: { damage: 6, cooldown: 1.0, range: 260, projectileCount: 4, pierce: 1, knockback: 30, speed: 520 },
    perLevel: { damage: 2, projectileCount: 1 },
    maxLevel: 5, tags: ['ranged', 'spread', 'thorn'], price: 18, tier: 2, palette: ['#9ccc65', '#33691e'],
  },

  // ============================================================ 武僧豆腐（五形拳法）
  {
    id: 'k_fist', name: '連環快拳', category: 'melee', behavior: 'melee', charId: 'monk_tofu',
    description: '極速的近身連拳，快到殘影。',
    base: { damage: 9, cooldown: 0.35, range: 90, projectileCount: 1, pierce: 99, knockback: 40, radius: 85 },
    perLevel: { damage: 3, cooldown: -0.02, radius: 4 },
    maxLevel: 5, critModifier: 1.5, tags: ['melee', 'fist'], price: 12, tier: 1, palette: ['#f5deb3', '#c9a227'],
  },
  {
    id: 'k_palm', name: '氣功掌', category: 'melee', behavior: 'projectile', charId: 'monk_tofu',
    description: '短距離推出的氣勁掌，把敵人大力震開。',
    base: { damage: 14, cooldown: 0.9, range: 200, projectileCount: 1, pierce: 1, knockback: 150, speed: 480, radius: 40 },
    perLevel: { damage: 5, knockback: 15 },
    maxLevel: 5, specialEffect: 'explode', tags: ['melee', 'knockback', 'chi'], price: 18, tier: 2, palette: ['#ffd54f', '#ff9800'],
  },
  {
    id: 'k_kick', name: '旋風腿', category: 'melee', behavior: 'orbit', charId: 'monk_tofu',
    description: '繞身連環迴旋踢，橫掃四周。',
    base: { damage: 12, cooldown: 1.0, range: 0, projectileCount: 2, pierce: 99, knockback: 60, radius: 100, speed: 3.8 },
    perLevel: { damage: 4, projectileCount: 0.5, radius: 8 },
    maxLevel: 5, tags: ['melee', 'orbit', 'kick'], price: 20, tier: 2, palette: ['#ffab91', '#e64a19'],
  },
  {
    id: 'k_staff', name: '醉棍', category: 'melee', behavior: 'melee', charId: 'monk_tofu',
    description: '長棍橫掃，攻擊範圍極大。',
    base: { damage: 16, cooldown: 0.9, range: 160, projectileCount: 1, pierce: 99, knockback: 90, radius: 150 },
    perLevel: { damage: 6, radius: 10 },
    maxLevel: 5, tags: ['melee', 'staff'], price: 20, tier: 2, palette: ['#8d6e63', '#5d4037'],
  },
  {
    id: 'k_qi', name: '氣功波', category: 'magic', behavior: 'projectile', charId: 'monk_tofu',
    description: '灌注真氣打出的氣勁波，貫穿一整列。',
    base: { damage: 13, cooldown: 1.1, range: 420, projectileCount: 1, pierce: 5, knockback: 30, speed: 560 },
    perLevel: { damage: 5, pierce: 1 },
    maxLevel: 5, tags: ['chi', 'pierce'], price: 22, tier: 3, palette: ['#80deea', '#00acc1'],
  },

  // ============================================================ 暴刺榴槤（中距離尖刺）
  {
    id: 'd_thornshot', name: '刺針射', category: 'ranged', behavior: 'projectile', charId: 'durian_spike',
    description: '射出尖銳的硬刺，中距離穩定輸出。',
    base: { damage: 11, cooldown: 0.7, range: 360, projectileCount: 1, pierce: 2, knockback: 40, speed: 560 },
    perLevel: { damage: 4, pierce: 0.5 },
    maxLevel: 5, tags: ['thorn', 'pierce'], price: 12, tier: 1, palette: ['#f0a83e', '#a8641e'],
  },
  {
    id: 'd_spikefan', name: '散刺', category: 'ranged', behavior: 'projectile', charId: 'durian_spike',
    description: '一次噴出一扇尖刺，掃射前方。',
    base: { damage: 6, cooldown: 0.85, range: 320, projectileCount: 4, pierce: 1, knockback: 30, speed: 520 },
    perLevel: { damage: 2, projectileCount: 1 },
    maxLevel: 5, tags: ['thorn', 'spread'], price: 18, tier: 2, palette: ['#e8823a', '#9c4a16'],
  },
  {
    id: 'd_caltrop', name: '鐵蒺藜', category: 'engineer', behavior: 'zone', charId: 'durian_spike',
    description: '在地面撒下鐵蒺藜，持續刺傷踩過的敵人。',
    base: { damage: 5, cooldown: 2.2, range: 300, projectileCount: 1, pierce: 0, knockback: 0, radius: 120, duration: 4, burn: 8 },
    perLevel: { burn: 3, radius: 10 },
    maxLevel: 5, tags: ['thorn', 'zone'], price: 20, tier: 2, palette: ['#8d6e63', '#455a64'],
  },
  {
    id: 'd_spikeorbit', name: '環刺', category: 'melee', behavior: 'orbit', charId: 'durian_spike',
    description: '繞身旋轉的尖刺護體。',
    base: { damage: 11, cooldown: 1.0, range: 0, projectileCount: 3, pierce: 99, knockback: 50, radius: 105, speed: 3.4 },
    perLevel: { damage: 4, projectileCount: 0.5, radius: 8 },
    maxLevel: 5, tags: ['thorn', 'orbit'], price: 20, tier: 2, palette: ['#8a7fa0', '#4a4258'],
  },
  {
    id: 'd_barb', name: '倒鉤鏢', category: 'ranged', behavior: 'projectile', charId: 'durian_spike',
    description: '帶倒鉤的重鏢，貫穿並大力擊退。',
    base: { damage: 16, cooldown: 1.0, range: 380, projectileCount: 1, pierce: 4, knockback: 90, speed: 560 },
    perLevel: { damage: 6, pierce: 1 },
    maxLevel: 5, critModifier: 1.5, tags: ['thorn', 'pierce', 'crit'], price: 22, tier: 3, palette: ['#e0512f', '#795548'],
  },
]

export const WEAPON_MAP = new Map(WEAPONS.map(w => [w.id, w]))

// 依角色 id 取得其 5 把專屬武器
export function weaponsForChar(charId: string): WeaponData[] {
  return WEAPONS.filter(w => w.charId === charId)
}

// 計算武器在指定等級的實際數值（base + perLevel×(level-1)；projectileCount 向下取整、冷卻有下限）
export function weaponStatsAt(w: WeaponData, level: number) {
  const s = { ...w.base }
  const lv = Math.min(level, w.maxLevel) - 1
  for (const [k, v] of Object.entries(w.perLevel)) {
    const key = k as keyof typeof s
    const val = (s[key] ?? 0) + (v as number) * lv
    ;(s as Record<string, number>)[key] = key === 'projectileCount' ? Math.floor(val) : val
  }
  s.cooldown = Math.max(0.15, s.cooldown)
  return s
}
