import type { WeaponData } from '../types'

// 武器系統（2026-07 大改版：共用池 + 簽名武器）：
// - 「簽名武器」（有 charId）：每角色 1 把，只有該角色能取得，是起手與角色識別核心。
// - 其餘為「共用池」：任何角色都能從商店/福袋/寶箱取得（親和 tag 權重見 shop.ts）。
// - 每把武器都有自己的機制識別（mech，server 實作 hook；behavior 決定基礎模擬方式）。
// - 穿透（pierce）刻意稀缺：只有長槍/狙擊/氣功波以穿透為識別，其餘 0~1 → 穿甲升級有價值。
export const WEAPONS: WeaponData[] = [
  // ============================================================ 簽名武器（每角色 1 把）
  {
    id: 'w_sword', name: '劍與盾', category: 'melee', behavior: 'melee', charId: 'warrior_sweetpotato',
    description: '穩健的半月斬；每第 3 擊蓄力橫掃，範圍與傷害大增。',
    base: { damage: 16, cooldown: 0.9, range: 110, projectileCount: 1, pierce: 99, knockback: 120, radius: 100 },
    perLevel: { damage: 6, radius: 8, knockback: 15 },
    mech: { id: 'comboNova', params: { every: 3, radiusMult: 1.6, dmgMult: 1.5 } },
    maxLevel: 5, tags: ['melee'], price: 12, tier: 1, palette: ['#d7dde2', '#8d99a6'],
  },
  {
    id: 'pea_gun', name: '手槍', category: 'ranged', behavior: 'projectile', charId: 'gunner_potato',
    description: '穩定的半自動手槍；彈匣有靈性——每第 5 發必定暴擊。',
    base: { damage: 9, cooldown: 0.7, range: 400, projectileCount: 1, pierce: 0, knockback: 30, speed: 560 },
    perLevel: { damage: 3, cooldown: -0.05 },
    mech: { id: 'critEvery', params: { n: 5 } },
    maxLevel: 5, tags: ['bullet'], price: 12, tier: 1, palette: ['#7bc043', '#4e8a22'],
  },
  {
    id: 'heal_orb', name: '治療球', category: 'support', behavior: 'healPulse', charId: 'medic_radish',
    description: '週期性治療自己與最傷的隊友，並以光療波灼傷周圍敵人。',
    base: { damage: 0, cooldown: 4.0, range: 260, projectileCount: 1, pierce: 0, knockback: 0, heal: 9 },
    perLevel: { heal: 3, cooldown: -0.35 },
    maxLevel: 5, tags: ['support', 'heal'], price: 16, tier: 1, palette: ['#7bd88f', '#3aa65c'],
  },
  {
    id: 'turret_gun', name: '自動砲塔', category: 'engineer', behavior: 'turret', charId: 'engineer_onion',
    description: '佈署自動攻擊的迷你砲塔（最多 2 座），陣地戰核心。',
    base: { damage: 7, cooldown: 6.0, range: 320, projectileCount: 1, pierce: 0, knockback: 20, speed: 540, duration: 9 },
    perLevel: { damage: 2.5, duration: 1.5 },
    maxLevel: 5, tags: ['engineer', 'summon'], price: 16, tier: 1, palette: ['#b0bec5', '#607d8b'],
  },
  {
    id: 'ice_shard', name: '冰刺', category: 'magic', behavior: 'projectile', charId: 'mage_yam',
    description: '傷害不高，但能減速、甚至凍住敵人的腳。',
    base: { damage: 6, cooldown: 0.85, range: 360, projectileCount: 1, pierce: 1, knockback: 20, speed: 500, slow: 0.4, duration: 2, freezeChance: 0.1 },
    perLevel: { damage: 2, slow: 0.05, freezeChance: 0.02 },
    maxLevel: 5, tags: ['magic', 'frost'], price: 12, tier: 1, palette: ['#a8e0ff', '#4fa8d8'],
  },
  {
    id: 't_dice', name: '骰子彈', category: 'ranged', behavior: 'projectile', charId: 'gambler_taro',
    description: '每次射擊擲骰決定傷害——0.4 倍到 2.5 倍，賭的就是心跳。',
    base: { damage: 11, cooldown: 0.8, range: 380, projectileCount: 1, pierce: 0, knockback: 30, speed: 560 },
    perLevel: { damage: 4 },
    mech: { id: 'diceDamage', params: { min: 0.4, max: 2.5 } },
    maxLevel: 5, critModifier: 1.6, tags: ['gamble', 'crit'], price: 12, tier: 1, palette: ['#f5f5f5', '#c62828'],
  },
  {
    id: 'knife', name: '飛刀', category: 'ranged', behavior: 'projectile', charId: 'assassin_sprout',
    description: '高攻速小刀；擊殺後進入 1.2 秒狂熱，攻速大幅提升。',
    base: { damage: 5, cooldown: 0.4, range: 320, projectileCount: 1, pierce: 0, knockback: 10, speed: 640 },
    perLevel: { damage: 2, projectileCount: 0.5 },
    mech: { id: 'frenzyKill', params: { atk: 0.5, dur: 1.2 } },
    maxLevel: 5, critModifier: 2.0, tags: ['crit', 'bullet'], price: 12, tier: 1, palette: ['#cfd8dc', '#78909c'],
  },
  {
    id: 's_iai', name: '居合斬', category: 'melee', behavior: 'melee', charId: 'samurai_tomato',
    description: '瞬間拔刀的半月斬；「一之太刀」對滿血敵人傷害 +60%。',
    base: { damage: 20, cooldown: 1.0, range: 130, projectileCount: 1, pierce: 99, knockback: 100, radius: 120 },
    perLevel: { damage: 8, radius: 8 },
    mech: { id: 'firstStrike', params: { mult: 1.6 } },
    maxLevel: 5, critModifier: 1.7, tags: ['melee', 'crit'], price: 12, tier: 1, palette: ['#e2402f', '#d7dde2'],
  },
  {
    id: 'c_gauntlet', name: '尖刺拳套', category: 'melee', behavior: 'melee', charId: 'cactus_thorns',
    description: '帶刺拳套近身連擊；每命中一個敵人就長出 0.5 點護盾（上限 20）。',
    base: { damage: 15, cooldown: 0.8, range: 100, projectileCount: 1, pierce: 99, knockback: 90, radius: 95 },
    perLevel: { damage: 6, radius: 6, knockback: 10 },
    mech: { id: 'thornShield', params: { amount: 0.5, cap: 20 } },
    maxLevel: 5, tags: ['melee', 'thorn'], price: 12, tier: 1, palette: ['#4c9a52', '#2f6b34'],
  },
  {
    id: 'k_fist', name: '連環快拳', category: 'melee', behavior: 'melee', charId: 'monk_tofu',
    description: '極速近身連拳；每第 10 拳打出巨大氣勁震盪，重創四周。',
    base: { damage: 9, cooldown: 0.35, range: 90, projectileCount: 1, pierce: 99, knockback: 40, radius: 85 },
    perLevel: { damage: 3, cooldown: -0.02, radius: 4 },
    mech: { id: 'comboNova', params: { every: 10, radiusMult: 2.2, dmgMult: 2 } },
    maxLevel: 5, critModifier: 1.5, tags: ['melee', 'fist'], price: 12, tier: 1, palette: ['#f5deb3', '#c9a227'],
  },
  {
    id: 'd_thornshot', name: '刺針射', category: 'ranged', behavior: 'projectile', charId: 'durian_spike',
    description: '射出尖銳硬刺；命中時 30% 機率迸出 2 根小刺掃向附近敵人。',
    base: { damage: 11, cooldown: 0.7, range: 360, projectileCount: 1, pierce: 0, knockback: 40, speed: 560 },
    perLevel: { damage: 4 },
    mech: { id: 'splitOnHit', params: { chance: 0.3, count: 2, pct: 0.5 } },
    maxLevel: 5, tags: ['thorn'], price: 12, tier: 1, palette: ['#f0a83e', '#a8641e'],
  },
  {
    id: 'h_spore', name: '孢子彈', category: 'magic', behavior: 'projectile', charId: 'hemp_mystic',
    description: '迷幻孢子彈；命中時 25% 機率炸出小型孢子雲，讓怪物神智不清。',
    base: { damage: 10, cooldown: 0.75, range: 340, projectileCount: 1, pierce: 0, knockback: 20, speed: 500 },
    perLevel: { damage: 4 },
    mech: { id: 'sporeCloud', params: { chance: 0.25, radius: 75, dur: 1.5 } },
    maxLevel: 5, tags: ['spore', 'magic'], price: 12, tier: 1, palette: ['#9b7fd4', '#5a3f8f'],
  },

  // ============================================================ 共用池 — 近戰
  {
    id: 'w_greatsword', name: '雙手大劍', category: 'melee', behavior: 'melee',
    description: '慢而沉重的巨劍；「處決」——對生命低於 30% 的敵人傷害翻倍。',
    base: { damage: 30, cooldown: 1.7, range: 140, projectileCount: 1, pierce: 99, knockback: 160, radius: 135 },
    perLevel: { damage: 11, radius: 10 },
    mech: { id: 'execute', params: { below: 0.3, mult: 2 } },
    maxLevel: 5, tags: ['melee', 'heavy'], price: 20, tier: 2, palette: ['#b0bec5', '#546e7a'],
  },
  {
    id: 'hammer', name: '戰鎚', category: 'melee', behavior: 'melee',
    description: '慢而痛的大鎚；「碎殼重壓」——對菁英與 Boss 傷害 +50%。',
    base: { damage: 24, cooldown: 1.6, range: 120, projectileCount: 1, pierce: 99, knockback: 220, radius: 110 },
    perLevel: { damage: 9, radius: 8, knockback: 20 },
    mech: { id: 'bossKiller', params: { mult: 1.5 } },
    maxLevel: 5, tags: ['melee', 'heavy', 'knockback'], price: 20, tier: 2, palette: ['#90a4ae', '#546e7a'],
  },
  {
    id: 'w_spear', name: '長槍', category: 'melee', behavior: 'projectile',
    description: '穿透之王——向前突刺、貫穿成排敵人，越練穿得越深。',
    base: { damage: 14, cooldown: 0.8, range: 260, projectileCount: 1, pierce: 4, knockback: 60, speed: 640 },
    perLevel: { damage: 5, pierce: 1 },
    maxLevel: 5, tags: ['melee', 'pierce'], price: 16, tier: 1, palette: ['#cfd8dc', '#8d6e63'],
  },
  {
    id: 'k_staff', name: '醉棍', category: 'melee', behavior: 'melee',
    description: '長棍橫掃，範圍極大；掃到的敵人越多、這一棍越痛（每個 +8%）。',
    base: { damage: 16, cooldown: 0.9, range: 160, projectileCount: 1, pierce: 99, knockback: 90, radius: 150 },
    perLevel: { damage: 6, radius: 10 },
    mech: { id: 'crowdBonus', params: { per: 0.08, cap: 0.8 } },
    maxLevel: 5, tags: ['melee', 'staff'], price: 20, tier: 2, palette: ['#8d6e63', '#5d4037'],
  },
  {
    id: 'c_shield', name: '荊棘盾', category: 'melee', behavior: 'melee',
    description: '帶刺硬殼盾撞——全場最強擊飛，30% 機率把小怪撞暈。',
    base: { damage: 18, cooldown: 1.4, range: 120, projectileCount: 1, pierce: 99, knockback: 240, radius: 110 },
    perLevel: { damage: 7, knockback: 25, radius: 8 },
    mech: { id: 'stunHit', params: { chance: 0.3, dur: 0.6 } },
    maxLevel: 5, tags: ['melee', 'knockback', 'thorn'], price: 18, tier: 2, palette: ['#388e3c', '#8bc34a'],
  },
  {
    id: 's_odachi', name: '大太刀', category: 'melee', behavior: 'melee',
    description: '巨大長刀橫掃全場；斬痕會持續流血（3 秒）。',
    base: { damage: 30, cooldown: 1.6, range: 150, projectileCount: 1, pierce: 99, knockback: 140, radius: 145 },
    perLevel: { damage: 11, radius: 10 },
    mech: { id: 'dotHit', params: { pct: 0.3, dur: 3 } },
    maxLevel: 5, critModifier: 1.7, tags: ['melee', 'heavy', 'crit'], price: 22, tier: 3, palette: ['#c62828', '#eceff1'],
  },
  {
    id: 'k_palm', name: '氣功掌', category: 'melee', behavior: 'projectile',
    description: '短距離推出的氣勁掌，命中即爆、把敵人大力震開。',
    base: { damage: 14, cooldown: 0.9, range: 200, projectileCount: 1, pierce: 1, knockback: 150, speed: 480, radius: 40 },
    perLevel: { damage: 5, knockback: 15 },
    maxLevel: 5, specialEffect: 'explode', tags: ['melee', 'knockback', 'chi'], price: 18, tier: 2, palette: ['#ffd54f', '#ff9800'],
  },

  // ============================================================ 共用池 — 遠程
  {
    id: 'g_sniper', name: '狙擊槍', category: 'ranged', behavior: 'projectile',
    description: '慢速高傷、貫穿一整列；子彈飛得越遠傷害越高（最高 +100%）。',
    base: { damage: 34, cooldown: 1.8, range: 620, projectileCount: 1, pierce: 3, knockback: 90, speed: 1100 },
    perLevel: { damage: 13, pierce: 1 },
    mech: { id: 'rangeRamp', params: { max: 1.0 } },
    maxLevel: 5, critModifier: 1.8, tags: ['bullet', 'sniper', 'crit', 'pierce'], price: 22, tier: 2, palette: ['#455a64', '#cfd8dc'],
  },
  {
    id: 'g_shotgun', name: '霰彈槍', category: 'ranged', behavior: 'projectile',
    description: '一次噴出一扇散彈；距離越近傷害越高（最高 +80%），貼臉毀滅。',
    base: { damage: 6, cooldown: 1.0, range: 240, projectileCount: 5, pierce: 0, knockback: 70, speed: 520 },
    perLevel: { damage: 2, projectileCount: 1 },
    mech: { id: 'closeRamp', params: { max: 0.8 } },
    maxLevel: 5, tags: ['bullet', 'spread'], price: 20, tier: 2, palette: ['#a1887f', '#5d4037'],
  },
  {
    id: 'g_smg', name: '衝鋒槍', category: 'ranged', behavior: 'projectile',
    description: '極高射速的傾瀉火力；子彈會小幅追蹤敵人。',
    base: { damage: 4, cooldown: 0.28, range: 360, projectileCount: 1, pierce: 0, knockback: 12, speed: 640 },
    perLevel: { damage: 1.5, cooldown: -0.02 },
    mech: { id: 'homing', params: { turn: 5 } },
    maxLevel: 5, tags: ['bullet', 'rapid'], price: 18, tier: 2, palette: ['#78909c', '#37474f'],
  },
  {
    id: 'g_minigun', name: '加特林', category: 'ranged', behavior: 'projectile',
    description: '六管轉輪——持續開火會越轉越快（攻速最高 +60%），停火就冷卻。',
    base: { damage: 5, cooldown: 0.22, range: 380, projectileCount: 1, pierce: 0, knockback: 15, speed: 680 },
    perLevel: { damage: 2, projectileCount: 0.34 },
    mech: { id: 'spinUp', params: { max: 0.6, ramp: 0.05 } },
    maxLevel: 5, tags: ['bullet', 'rapid'], price: 26, tier: 3, palette: ['#ffca28', '#f57f17'],
  },
  {
    id: 't_cards', name: '飛牌扇', category: 'ranged', behavior: 'projectile',
    description: '一次擲出一扇撲克飛牌；飛牌碰到場邊會反彈（最多 2 次）。',
    base: { damage: 5, cooldown: 0.7, range: 340, projectileCount: 3, pierce: 0, knockback: 10, speed: 600 },
    perLevel: { damage: 2, projectileCount: 0.5 },
    mech: { id: 'wallBounce', params: { bounces: 2 } },
    maxLevel: 5, critModifier: 1.6, tags: ['gamble', 'spread'], price: 18, tier: 2, palette: ['#eceff1', '#212121'],
  },
  {
    id: 't_coin', name: '金幣槍', category: 'ranged', behavior: 'projectile',
    description: '射出金幣；擊殺時 35% 機率迸出額外金幣——用錢滾錢。',
    base: { damage: 11, cooldown: 0.9, range: 380, projectileCount: 1, pierce: 0, knockback: 40, speed: 560 },
    perLevel: { damage: 4 },
    mech: { id: 'killGold', params: { chance: 0.35, gold: 2 } },
    maxLevel: 5, tags: ['gamble', 'gold'], price: 20, tier: 2, palette: ['#ffd54f', '#b8860b'],
  },
  {
    id: 'a_fan', name: '飛刀扇', category: 'ranged', behavior: 'projectile',
    description: '一次擲出一扇飛刀；暴擊時裂成 2 把追加小刀。',
    base: { damage: 5, cooldown: 0.7, range: 320, projectileCount: 4, pierce: 0, knockback: 10, speed: 660 },
    perLevel: { damage: 2, projectileCount: 0.5 },
    mech: { id: 'splitOnCrit', params: { count: 2, pct: 0.5 } },
    maxLevel: 5, critModifier: 1.8, tags: ['crit', 'spread'], price: 20, tier: 2, palette: ['#eceff1', '#607d8b'],
  },
  {
    id: 's_kunai', name: '苦無', category: 'ranged', behavior: 'projectile',
    description: '擲出的苦無命中後會彈射到最近的下一個敵人（最多 2 跳）。',
    base: { damage: 10, cooldown: 0.6, range: 360, projectileCount: 1, pierce: 0, knockback: 20, speed: 660 },
    perLevel: { damage: 4 },
    mech: { id: 'ricochet', params: { jumps: 2 } },
    maxLevel: 5, critModifier: 1.6, tags: ['crit'], price: 16, tier: 2, palette: ['#616161', '#212121'],
  },
  {
    id: 'd_barb', name: '倒鉤鏢', category: 'ranged', behavior: 'projectile',
    description: '帶倒鉤的重鏢；被釘中的敵人 3 秒內受到所有來源傷害 +15%（隊友也吃加成）。',
    base: { damage: 16, cooldown: 1.0, range: 380, projectileCount: 1, pierce: 1, knockback: 90, speed: 560 },
    perLevel: { damage: 6 },
    mech: { id: 'markHit', params: { mult: 1.15, dur: 3 } },
    maxLevel: 5, critModifier: 1.5, tags: ['thorn', 'crit'], price: 22, tier: 3, palette: ['#e0512f', '#795548'],
  },
  {
    id: 'c_seed', name: '種子散射', category: 'ranged', behavior: 'projectile',
    description: '噴出一扇帶刺種子；被種子擊殺的敵人會爆出 3 顆追加種子。',
    base: { damage: 6, cooldown: 1.0, range: 260, projectileCount: 4, pierce: 0, knockback: 30, speed: 520 },
    perLevel: { damage: 2, projectileCount: 1 },
    mech: { id: 'splitOnKill', params: { count: 3, pct: 0.4 } },
    maxLevel: 5, tags: ['thorn', 'spread'], price: 18, tier: 2, palette: ['#9ccc65', '#33691e'],
  },
  {
    id: 'h_pollen', name: '花粉扇', category: 'magic', behavior: 'projectile',
    description: '一扇迷幻花粉；命中 20% 機率讓敵人陷入混亂、自相殘殺。',
    base: { damage: 6, cooldown: 0.9, range: 300, projectileCount: 4, pierce: 0, knockback: 15, speed: 460 },
    perLevel: { damage: 2, projectileCount: 1 },
    mech: { id: 'confuseHit', params: { chance: 0.2, dur: 1.5 } },
    maxLevel: 5, tags: ['spore', 'spread', 'magic'], price: 18, tier: 2, palette: ['#e05fd0', '#a03a8f'],
  },
  {
    id: 'm_needle', name: '吸血針', category: 'support', behavior: 'projectile',
    description: '發射高速針劑，抽取生命——造成傷害的 12% 轉為自己的生命。',
    base: { damage: 9, cooldown: 0.6, range: 380, projectileCount: 1, pierce: 0, knockback: 15, speed: 620 },
    perLevel: { damage: 3 },
    mech: { id: 'lifesteal', params: { pct: 0.12 } },
    maxLevel: 5, tags: ['support', 'bullet', 'heal'], price: 16, tier: 2, palette: ['#e57373', '#c62828'],
  },
  {
    id: 'e_flame', name: '火焰噴射器', category: 'engineer', behavior: 'projectile',
    description: '近距離噴出高速火舌；點燃敵人持續燃燒 2 秒。',
    base: { damage: 6, cooldown: 0.25, range: 200, projectileCount: 1, pierce: 1, knockback: 8, speed: 440 },
    perLevel: { damage: 2 },
    mech: { id: 'dotHit', params: { pct: 0.4, dur: 2 } },
    maxLevel: 5, tags: ['engineer', 'fire'], price: 24, tier: 3, palette: ['#ff7043', '#e64a19'],
  },

  // ============================================================ 共用池 — 魔法
  {
    id: 'fireball', name: '火球', category: 'magic', behavior: 'projectile',
    description: '命中後爆炸的火球，並在地面留下短暫燃燒區。',
    base: { damage: 14, cooldown: 1.4, range: 380, projectileCount: 1, pierce: 0, knockback: 60, speed: 440, radius: 85 },
    perLevel: { damage: 5, radius: 10 },
    mech: { id: 'burnGround', params: { pct: 0.35, dur: 2 } },
    maxLevel: 5, specialEffect: 'explode', tags: ['magic', 'explosive', 'fire'], price: 20, tier: 2, palette: ['#ff6b35', '#c9302c'],
  },
  {
    id: 'lightning', name: '閃電鏈', category: 'magic', behavior: 'chain',
    description: '在敵人之間跳躍的電弧，越練跳得越多。',
    base: { damage: 9, cooldown: 1.3, range: 340, projectileCount: 1, pierce: 0, knockback: 0, chains: 3, radius: 170 },
    perLevel: { damage: 3, chains: 1 },
    maxLevel: 5, tags: ['magic', 'lightning'], price: 20, tier: 2, palette: ['#ffe66d', '#f0a500'],
  },
  {
    id: 'k_qi', name: '氣功波', category: 'magic', behavior: 'projectile',
    description: '貫穿一整列的氣勁波；每穿過一個敵人，傷害遞增 12%。',
    base: { damage: 13, cooldown: 1.1, range: 420, projectileCount: 1, pierce: 4, knockback: 30, speed: 560 },
    perLevel: { damage: 5, pierce: 1 },
    mech: { id: 'pierceRamp', params: { per: 0.12 } },
    maxLevel: 5, tags: ['chi', 'pierce', 'magic'], price: 22, tier: 3, palette: ['#80deea', '#00acc1'],
  },

  // ============================================================ 共用池 — 環繞
  {
    id: 'spin_axe', name: '迴旋斧', category: 'melee', behavior: 'orbit',
    description: '繞身旋轉的斧頭；升級主要增加斧頭數量，滿級一整圈斧牆。',
    base: { damage: 10, cooldown: 1.1, range: 0, projectileCount: 1, pierce: 99, knockback: 60, radius: 95, speed: 3.2 },
    perLevel: { damage: 3, projectileCount: 1 },
    maxLevel: 5, tags: ['melee', 'orbit'], price: 16, tier: 1, palette: ['#ff9f43', '#b0682a'],
  },
  {
    id: 'a_shuriken', name: '手裏劍環', category: 'ranged', behavior: 'orbit',
    description: '繞身高速旋轉的手裏劍，轉速全場最快、暴擊驚人。',
    base: { damage: 9, cooldown: 0.9, range: 0, projectileCount: 3, pierce: 99, knockback: 20, radius: 95, speed: 4.6 },
    perLevel: { damage: 3, projectileCount: 0.5, radius: 6 },
    maxLevel: 5, critModifier: 2.0, tags: ['crit', 'orbit'], price: 20, tier: 2, palette: ['#b0bec5', '#455a64'],
  },
  {
    id: 'c_whip', name: '仙人掌鞭', category: 'melee', behavior: 'orbit',
    description: '繞身抽打的帶刺長鞭——半徑全場最大，把怪擋在圈外。',
    base: { damage: 11, cooldown: 1.1, range: 0, projectileCount: 1, pierce: 99, knockback: 90, radius: 130, speed: 3.0 },
    perLevel: { damage: 4, projectileCount: 0.5, radius: 12 },
    maxLevel: 5, tags: ['melee', 'orbit', 'thorn'], price: 18, tier: 2, palette: ['#66bb6a', '#1b5e20'],
  },

  // ============================================================ 共用池 — 區域（四把四種地面玩法）
  {
    id: 'poison_flask', name: '毒菱', category: 'magic', behavior: 'zone',
    description: '撒出毒菱留下毒區；毒素會不斷疊加，泡越久越痛。',
    base: { damage: 4, cooldown: 2.4, range: 320, projectileCount: 1, pierce: 0, knockback: 0, radius: 110, duration: 4, burn: 7 },
    perLevel: { burn: 3, radius: 10 },
    mech: { id: 'stackDot' },
    maxLevel: 5, tags: ['poison', 'zone'], price: 20, tier: 2, palette: ['#9ccc65', '#558b2f'],
  },
  {
    id: 'y_frost', name: '冰霜地帶', category: 'magic', behavior: 'zone',
    description: '在地面凝出冰霜區：圈內重度減速，每下還有機率直接凍結。',
    base: { damage: 4, cooldown: 2.4, range: 320, projectileCount: 1, pierce: 0, knockback: 0, radius: 120, duration: 4, burn: 5 },
    perLevel: { burn: 2, radius: 12 },
    mech: { id: 'frostZone', params: { slow: 0.5, freeze: 0.06 } },
    maxLevel: 5, tags: ['magic', 'frost', 'zone'], price: 22, tier: 2, palette: ['#4fc3f7', '#01579b'],
  },
  {
    id: 'e_laser', name: '雷射柵欄', category: 'engineer', behavior: 'zone',
    description: '架起灼熱雷射網；持續照射的傷害每半秒遞增 18%，站好站滿。',
    base: { damage: 5, cooldown: 2.6, range: 320, projectileCount: 1, pierce: 0, knockback: 0, radius: 115, duration: 4, burn: 8 },
    perLevel: { burn: 3, radius: 8 },
    mech: { id: 'rampZone', params: { per: 0.18 } },
    maxLevel: 5, tags: ['engineer', 'zone', 'fire'], price: 22, tier: 2, palette: ['#ff5252', '#b71c1c'],
  },
  {
    id: 'c_spikes', name: '地刺柱', category: 'engineer', behavior: 'zone',
    description: '從地面刺出尖刺區，每次脈衝刺傷並彈開圈內敵人——會走路的柵欄。',
    base: { damage: 5, cooldown: 2.4, range: 300, projectileCount: 1, pierce: 0, knockback: 0, radius: 115, duration: 4, burn: 8 },
    perLevel: { burn: 3, radius: 10 },
    mech: { id: 'pulseZone', params: { kb: 180 } },
    maxLevel: 5, tags: ['zone', 'thorn'], price: 20, tier: 2, palette: ['#558b2f', '#33691e'],
  },

  // ============================================================ 共用池 — 部署
  {
    id: 'mine', name: '地雷', category: 'engineer', behavior: 'mine',
    description: '定時在腳邊佈雷，踩到就是一大片爆炸。',
    base: { damage: 26, cooldown: 2.2, range: 90, projectileCount: 1, pierce: 99, knockback: 120, radius: 100, duration: 12 },
    perLevel: { damage: 9, cooldown: -0.22 },
    maxLevel: 5, specialEffect: 'explode', tags: ['engineer', 'explosive'], price: 16, tier: 1, palette: ['#8a6d3b', '#ffcf5c'],
  },
  {
    id: 'drone', name: '無人機', category: 'summon', behavior: 'drone',
    description: '跟著你飛的小飛機，自動掃射附近敵人——不用瞄準的第二把槍。',
    base: { damage: 6, cooldown: 0.65, range: 300, projectileCount: 1, pierce: 0, knockback: 10, speed: 560 },
    perLevel: { damage: 2, cooldown: -0.05 },
    maxLevel: 5, tags: ['summon', 'bullet'], price: 20, tier: 2, palette: ['#4fc3f7', '#0288d1'],
  },
]

export const WEAPON_MAP = new Map(WEAPONS.map(w => [w.id, w]))

/** 角色可取得的武器池：共用池 + 自己的簽名武器（商店/福袋/寶箱共用這個判定） */
export function weaponsForChar(charId: string): WeaponData[] {
  return WEAPONS.filter(w => !w.evolvedForm && (!w.charId || w.charId === charId))
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
