import type { UpgradeData, Rarity, StatMods, UpgradeCategory } from '../types'

// 第一版 60+ 個升級（最終版 150+）。大多是純 statMods，特殊行為走 specialEffect id。
// 稀有度預設：weight / price（可個別覆寫）。
const R: Record<Rarity, { weight: number; price: number }> = {
  common: { weight: 100, price: 10 },
  rare: { weight: 40, price: 20 },
  epic: { weight: 12, price: 38 },
  legendary: { weight: 3, price: 70 },
  cursed: { weight: 14, price: 8 },
}

function U(
  id: string, name: string, description: string, rarity: Rarity, category: UpgradeCategory,
  extra: Partial<UpgradeData> & { statMods?: StatMods } = {},
): UpgradeData {
  return {
    id, name, description, rarity, category,
    tags: [], weight: R[rarity].weight, maxStacks: 3, price: R[rarity].price,
    ...extra,
  }
}

export const UPGRADES: UpgradeData[] = [
  // ============================== 基礎屬性（common → epic 三檔）
  U('dmg1', '磨利菜刀', '傷害 +8%', 'common', 'stat', { statMods: { damage: 0.08 }, maxStacks: 10 }),
  U('dmg2', '精鍛菜刀', '傷害 +15%', 'rare', 'stat', { statMods: { damage: 0.15 }, maxStacks: 8 }),
  U('dmg3', '傳家寶刀', '傷害 +25%', 'epic', 'stat', { statMods: { damage: 0.25 }, maxStacks: 6 }),
  U('atk1', '手腳俐落', '攻擊速度 +8%', 'common', 'stat', { statMods: { attackSpeed: 0.08 }, maxStacks: 10 }),
  U('atk2', '農忙節奏', '攻擊速度 +15%', 'rare', 'stat', { statMods: { attackSpeed: 0.15 }, maxStacks: 8 }),
  U('hp1', '厚實根莖', '最大生命 +12', 'common', 'stat', { statMods: { maxHp: 12 }, maxStacks: 10 }),
  U('hp2', '土壤滋養', '最大生命 +25', 'rare', 'stat', { statMods: { maxHp: 25 }, maxStacks: 8 }),
  U('spd1', '輕便草鞋', '移動速度 +6%', 'common', 'stat', { statMods: { moveSpeed: 0.06 }, maxStacks: 6 }),
  U('spd2', '疾風跑鞋', '移動速度 +12%', 'rare', 'stat', { statMods: { moveSpeed: 0.12 }, maxStacks: 5 }),
  U('crit1', '銳眼', '暴擊率 +5%', 'common', 'stat', { statMods: { critChance: 0.05 }, maxStacks: 8 }),
  U('crit2', '獵手直覺', '暴擊率 +10%', 'rare', 'stat', { statMods: { critChance: 0.1 }, maxStacks: 3 }),
  U('critd1', '重擊要害', '暴擊傷害 +20%', 'common', 'stat', { statMods: { critDamage: 0.2 }, maxStacks: 8 }),
  U('pick1', '長柄耙子', '拾取範圍 +25', 'common', 'stat', { statMods: { pickupRange: 25 }, maxStacks: 4 }),
  U('armor1', '木盾', '護甲 +1', 'common', 'stat', { statMods: { armor: 1 }, maxStacks: 8 }),
  U('armor2', '鐵鍋盾', '護甲 +2', 'rare', 'stat', { statMods: { armor: 2 }, maxStacks: 6 }),
  U('regen1', '光合作用', '每秒回復 +0.5', 'common', 'stat', { statMods: { regen: 0.5 }, maxStacks: 8 }),
  U('regen2', '深根蓄水', '每秒回復 +1.2', 'rare', 'stat', { statMods: { regen: 1.2 }, maxStacks: 3 }),
  U('cdr1', '冷靜思考', '技能冷卻 -8%', 'common', 'stat', { statMods: { cooldown: 0.08 }, maxStacks: 4 }),
  U('cdr2', '禪定農法', '技能冷卻 -15%', 'rare', 'stat', { statMods: { cooldown: 0.15 }, maxStacks: 3 }),
  U('gold1', '討價還價', '金幣獲得 +12%', 'common', 'stat', { statMods: { goldGain: 0.12 }, maxStacks: 4 }),
  U('xp1', '勤學筆記', '經驗獲得 +10%', 'common', 'stat', { statMods: { xpGain: 0.1 }, maxStacks: 4 }),
  U('luck1', '幸運草', '幸運 +10%（稀有度/掉落判定）', 'rare', 'stat', { statMods: { luck: 0.1 }, maxStacks: 3 }),

  // ============================== 武器特化
  U('wpierce', '穿甲彈頭', '子彈穿透 +1（僅射彈武器）', 'rare', 'weapon', { statMods: { pierce: 1 }, maxStacks: 3, tags: ['bullet'] }),
  U('wproj', '多管改造', '投射物 +1（所有投射武器）', 'epic', 'weapon', { statMods: { projectiles: 1 }, maxStacks: 2 }),
  U('warea', '大爆炸理論', '爆炸/區域範圍 +18%', 'rare', 'weapon', { statMods: { area: 0.18 }, maxStacks: 3, tags: ['explosive', 'zone'] }),
  U('wmelee', '長柄改裝', '近戰範圍 +20%', 'rare', 'weapon', { specialEffect: 'meleeRange', maxStacks: 3, tags: ['melee'] }),
  U('wfrost', '極地配方', '冰凍/減速時間 +30%', 'rare', 'weapon', { specialEffect: 'frostDuration', maxStacks: 3, tags: ['frost'], requirements: ['weaponTag:frost'] }),
  U('wchain', '超導線圈', '閃電連鎖 +1', 'rare', 'weapon', { specialEffect: 'chainPlus', maxStacks: 3, tags: ['lightning'], requirements: ['weaponTag:lightning'] }),
  U('wmine', '快速佈雷', '地雷/工程武器冷卻 -15%', 'rare', 'weapon', { specialEffect: 'engineerCd', maxStacks: 3, tags: ['engineer'], requirements: ['weaponTag:engineer'] }),
  U('wturret', '加固底座', '砲塔持續時間 +40%', 'rare', 'weapon', { specialEffect: 'turretDuration', maxStacks: 3, tags: ['engineer'], requirements: ['weaponTag:summon'] }),
  U('wknock', '衝擊配重', '擊退 +40%', 'common', 'weapon', { specialEffect: 'knockbackUp', maxStacks: 3 }),
  // 武器精研：唯一「免費升武器」管道（升級三選一常駐）——修掉「簽名武器 30 波還是 Lv1」
  U('w_up', '武器精研', '最低等級的一把武器 +1 級（優先職業專屬武器）', 'common', 'weapon', { specialEffect: 'weaponLevelUp', maxStacks: 99, weight: 65, price: 14 }),
  U('wpoison', '濃縮毒素', '持續傷害 +30%', 'rare', 'weapon', { specialEffect: 'dotUp', maxStacks: 3, tags: ['poison'], requirements: ['weaponTag:poison'] }),
  U('wheal', '強效藥劑', '治療效果 +30%', 'rare', 'weapon', { specialEffect: 'healPower', maxStacks: 3, tags: ['heal'] }),
  U('wspeed', '流線彈道', '投射物速度 +25%、射程 +10%', 'common', 'weapon', { specialEffect: 'projSpeed', maxStacks: 3 }),

  // ============================== 合作 — 救援
  U('c_rescue1', '急救訓練', '救援速度 +30%', 'common', 'coop', { statMods: { reviveSpeed: 0.3 }, maxStacks: 3 }),
  U('c_rescue2', '救援護盾', '救援時獲得 25 點護盾', 'rare', 'coop', { specialEffect: 'rescueShield', maxStacks: 2 }),
  U('c_rescue3', '互相扶持', '救起隊友後，雙方回復 20% 生命', 'rare', 'coop', { specialEffect: 'rescueHealBoth', maxStacks: 1 }),
  U('c_rescue4', '起身震盪', '救援完成時擊退附近敵人', 'rare', 'coop', { specialEffect: 'rescueKnockback', maxStacks: 1 }),
  U('c_rescue5', '頑強意志', '倒地流血時間 +15 秒', 'common', 'coop', { specialEffect: 'downTimeUp', maxStacks: 2 }),
  U('c_rescue6', '不倒蔬魂', '每局第一次倒地自動復活', 'epic', 'coop', { specialEffect: 'firstDownAutoRevive', maxStacks: 1 }),

  // ============================== 合作 — 站位
  U('c_pos1', '並肩作戰', '160 範圍內有隊友時，傷害 +10%', 'common', 'coop', { specialEffect: 'nearAllyDamage', maxStacks: 3 }),
  U('c_pos2', '結陣', '160 範圍內有隊友時，護甲 +1', 'common', 'coop', { specialEffect: 'nearAllyArmor', maxStacks: 3 }),
  U('c_pos3', '溫暖同行', '160 範圍內有隊友時，回血速度 +1/秒', 'rare', 'coop', { specialEffect: 'nearAllyRegen', maxStacks: 2 }),
  U('c_pos4', '快步會合', '與最近隊友距離 >400 時，移動速度 +15%', 'common', 'coop', { specialEffect: 'farAllySpeed', maxStacks: 2 }),

  // ============================== 合作 — 資源
  U('c_res1', '有福同享', '你撿的金幣，附近隊友也獲得 30%', 'rare', 'coop', { specialEffect: 'coinShare', maxStacks: 1 }),
  U('c_res2', '共學小組', '經驗共享範圍 +50%', 'common', 'coop', { specialEffect: 'xpShareRange', maxStacks: 2 }),
  U('c_res3', '尋寶老手', '金幣獲得 +20%', 'rare', 'coop', { statMods: { goldGain: 0.2 }, maxStacks: 2 }),
  U('c_res4', '同仇敵愾', '暴擊率 +5%', 'rare', 'coop', { statMods: { critChance: 0.05 }, maxStacks: 2 }),
  U('c_res5', '開箱達人', '寶箱獎勵 +1 選項', 'epic', 'coop', { specialEffect: 'chestBonus', maxStacks: 1 }),

  // ============================== 合作 — 防守
  U('c_def2', '哨戒協議', '你的砲塔優先攻擊靠近隊友的怪物', 'common', 'coop', { specialEffect: 'turretGuard', maxStacks: 1, requirements: ['weaponTag:engineer'] }),
  U('c_def3', '群體醫療', '治療效果可再多影響 1 名隊友', 'rare', 'coop', { specialEffect: 'healSpread', maxStacks: 2, tags: ['heal'] }),
  U('c_def4', '護盾網路', '獲得護盾時，分享 30% 給附近隊友', 'epic', 'coop', { specialEffect: 'shieldShare', maxStacks: 1 }),

  // ============================== 角色專屬（純被動加成，只在該角色的商店/升級出現）
  U('ch_tank', '劍盾精通', '【戰士地瓜】傷害 +15%、攻速 +8%', 'rare', 'character', { statMods: { damage: 0.15, attackSpeed: 0.08 }, maxStacks: 3, requirements: ['char:warrior_sweetpotato'] }),
  U('ch_gun', '槍械精通', '【槍手馬鈴薯】攻速 +18%', 'rare', 'character', { statMods: { attackSpeed: 0.18 }, maxStacks: 3, requirements: ['char:gunner_potato'] }),
  U('ch_med', '醫術精進', '【醫生蘿蔔】攻速 +12%、傷害 +8%', 'rare', 'character', { statMods: { attackSpeed: 0.12, damage: 0.08 }, maxStacks: 3, requirements: ['char:medic_radish'] }),
  U('ch_eng', '工程強化', '【工程洋蔥】傷害 +15%', 'rare', 'character', { statMods: { damage: 0.15 }, maxStacks: 3, requirements: ['char:engineer_onion'] }),
  U('ch_mage', '法力灌注', '【冰法番薯】傷害 +18%', 'rare', 'character', { statMods: { damage: 0.18 }, maxStacks: 3, requirements: ['char:mage_yam'] }),
  U('ch_gam', '賭運高漲', '【賭徒芋頭】暴擊率 +10%、暴傷 +25%', 'rare', 'character', { statMods: { critChance: 0.1, critDamage: 0.25 }, maxStacks: 3, requirements: ['char:gambler_taro'] }),
  U('ch_sam', '拔刀精髓', '【武士番茄】暴傷 +30%、傷害 +10%', 'rare', 'character', { statMods: { critDamage: 0.3, damage: 0.1 }, maxStacks: 3, requirements: ['char:samurai_tomato'] }),
  U('ch_asn', '暗殺技巧', '【刺客豆芽】暴擊率 +12%、攻速 +10%', 'rare', 'character', { statMods: { critChance: 0.12, attackSpeed: 0.1 }, maxStacks: 3, requirements: ['char:assassin_sprout'] }),
  U('ch_cac', '尖刺強化', '【反甲仙人掌】傷害 +15%、移速 +5%', 'rare', 'character', { statMods: { damage: 0.15, moveSpeed: 0.05 }, maxStacks: 3, requirements: ['char:cactus_thorns'] }),
  U('ch_monk', '拳意通神', '【武僧豆腐】攻速 +12%、傷害 +10%', 'rare', 'character', { statMods: { attackSpeed: 0.12, damage: 0.1 }, maxStacks: 3, requirements: ['char:monk_tofu'] }),
  U('ch_dur', '尖刺蓄能', '【暴刺榴槤】傷害 +12%、範圍 +10%', 'rare', 'character', { statMods: { damage: 0.12, area: 0.1 }, maxStacks: 3, requirements: ['char:durian_spike'] }),
  U('ch_hemp', '孢子共鳴', '【迷幻大麻】傷害 +12%、範圍 +12%', 'rare', 'character', { statMods: { damage: 0.12, area: 0.12 }, maxStacks: 3, requirements: ['char:hemp_mystic'] }),

  // ============================== 詛咒（強力但有代價）
  U('x_glass', '玻璃大砲', '傷害 +40%，但最大生命 -25%', 'cursed', 'curse', { specialEffect: 'curseGlass', statMods: { damage: 0.4 }, maxStacks: 1 }),
  U('x_frenzy', '躁動汁液', '攻速 +35%，但每秒流失 0.8 生命', 'cursed', 'curse', { specialEffect: 'curseFrenzy', statMods: { attackSpeed: 0.35 }, maxStacks: 1 }),
  U('x_greed', '貪婪契約', '金幣掉落 +50%，但怪物移動速度 +10%', 'cursed', 'curse', { specialEffect: 'curseGreed', statMods: { goldGain: 0.5 }, maxStacks: 1 }),
  U('x_edge', '孤注一擲', '暴擊率 +25%，但非暴擊傷害 -20%', 'cursed', 'curse', { specialEffect: 'curseEdge', statMods: { critChance: 0.25 }, maxStacks: 1 }),
  U('x_bag', '超載背包', '武器欄 +1（最多 7），但商店價格 +25%', 'cursed', 'curse', { specialEffect: 'curseBag', maxStacks: 1 }),
  U('x_shell', '硬殼詛咒', '開場獲得 60 護盾，但無法自然回血', 'cursed', 'curse', { specialEffect: 'curseShell', maxStacks: 1 }),

  // ============================== 傳說
  U('l_arsenal', '滿園武裝', '所有武器投射物 +1', 'legendary', 'legendary', { statMods: { projectiles: 1 }, maxStacks: 1, weight: 4 }),
  U('l_charge', '雙重蓄能', '主動技能可儲存 2 次', 'legendary', 'legendary', { specialEffect: 'skillCharges', maxStacks: 1 }),
  U('l_trophy', '獵人勳章', '每擊殺 1 隻菁英怪，永久傷害 +3%', 'legendary', 'legendary', { specialEffect: 'eliteTrophy', maxStacks: 1 }),
  U('l_phoenix', '不死菜心', '倒地後原地自動復活一次（每局）', 'legendary', 'legendary', { specialEffect: 'phoenix', maxStacks: 1 }),
  U('l_pulse', '大地脈衝', '每 10 秒對全場敵人釋放一次衝擊波', 'legendary', 'legendary', { specialEffect: 'pulse10s', maxStacks: 1 }),
  U('l_boom', '連鎖收割', '擊殺怪物有 8% 機率觸發範圍爆炸', 'legendary', 'legendary', { specialEffect: 'killExplode', maxStacks: 1 }),
  U('l_juggernaut', '不動要塞', '最大生命 +120', 'legendary', 'legendary', { statMods: { maxHp: 120 }, maxStacks: 1 }),
  U('l_berserk', '嗜血狂戰', '傷害 +30%、攻速 +20%', 'legendary', 'legendary', { statMods: { damage: 0.3, attackSpeed: 0.2 }, maxStacks: 1 }),

  // ============================== 技能強化 / 高階戰力（build 天花板）
  U('atk3', '狂風之刃', '攻擊速度 +25%', 'epic', 'stat', { statMods: { attackSpeed: 0.25 }, maxStacks: 5 }),
  U('dmg5', '巨人之力', '傷害 +40%', 'epic', 'stat', { statMods: { damage: 0.4 }, maxStacks: 5 }),
  U('sk_pow', '奧義精通', '主動技能傷害 +35%', 'rare', 'stat', { specialEffect: 'skillPower', maxStacks: 6 }),
  U('l_dmgx', '禁忌菜譜', '傷害 ×1.4（乘算）', 'legendary', 'legendary', { specialEffect: 'dmgX', maxStacks: 3, weight: 4 }),
  // ---- 乘算傷害階梯（rare→epic→legendary）：後期滾到百萬/千萬的引擎，不疊乘算 = 過不了 25 波
  U('dmgx_r', '複利刀法', '傷害 ×1.08（乘算，可疊）', 'rare', 'stat', { specialEffect: 'dmgXr', maxStacks: 8, price: 26 }),
  U('dmgx_e', '倍力精華', '傷害 ×1.18（乘算，可疊）', 'epic', 'stat', { specialEffect: 'dmgXe', maxStacks: 6, price: 48 }),
  // ---- 對象特化
  U('hunt_e', '獵魔專精', '對菁英與 Boss 傷害 +30%', 'rare', 'stat', { specialEffect: 'eliteDmg', maxStacks: 3, price: 24 }),
  // ---- 防禦 / 開場
  U('armor3', '龜甲祕術', '護甲 +3', 'epic', 'stat', { statMods: { armor: 3 }, maxStacks: 4 }),
  U('wshield', '晨間武裝', '每波開場獲得 20 點護盾', 'rare', 'stat', { specialEffect: 'waveShieldUp', maxStacks: 3, price: 20 }),
  // ---- 功能型（經驗/金幣/幸運 build——要能跟輸出流分庭抗禮）
  U('xp2', '天才筆記', '經驗獲得 +25%', 'rare', 'stat', { statMods: { xpGain: 0.25 }, maxStacks: 4 }),
  U('gold3', '點石成金', '金幣獲得 +40%', 'epic', 'stat', { statMods: { goldGain: 0.4 }, maxStacks: 3 }),
  U('luck2', '四葉幸運草', '幸運 +25%（稀有度/掉落判定）', 'epic', 'stat', { statMods: { luck: 0.25 }, maxStacks: 3 }),
  U('l_sage', '賢者之石', '經驗獲得 +60%，且每等級的傷害加成翻倍', 'legendary', 'legendary', { statMods: { xpGain: 0.6 }, specialEffect: 'sage', maxStacks: 1 }),
  U('l_midas', '邁達斯之手', '金幣獲得 +60%，擊殺 12% 機率噴出金幣', 'legendary', 'legendary', { statMods: { goldGain: 0.6 }, specialEffect: 'midas', maxStacks: 1 }),

  // ============================== 追加基礎/吸血（純數值，擴充 build 空間）
  U('life1', '嗜血', '每擊殺回復 1 生命', 'common', 'stat', { statMods: { lifeOnKill: 1 }, maxStacks: 6 }),
  U('life2', '飢餓收割', '每擊殺回復 2 生命', 'rare', 'stat', { statMods: { lifeOnKill: 2 }, maxStacks: 3 }),
  U('dmg4', '狂暴之力', '傷害 +12%', 'common', 'stat', { statMods: { damage: 0.12 }, maxStacks: 10 }),
  U('critd2', '致命一擊', '暴擊傷害 +40%', 'rare', 'stat', { statMods: { critDamage: 0.4 }, maxStacks: 6 }),
  U('crit3', '鷹眼', '暴擊率 +8%', 'rare', 'stat', { statMods: { critChance: 0.08 }, maxStacks: 6 }),
  U('area2', '領域擴張', '範圍效果 +12%', 'rare', 'stat', { statMods: { area: 0.12 }, maxStacks: 6 }),
  U('pick2', '磁化外套', '拾取範圍 +50', 'rare', 'stat', { statMods: { pickupRange: 50 }, maxStacks: 3 }),
  U('spd3', '疾風之靴', '移動速度 +10%', 'rare', 'stat', { statMods: { moveSpeed: 0.1 }, maxStacks: 3 }),
  U('gold2', '黃金之手', '金幣獲得 +25%', 'rare', 'stat', { statMods: { goldGain: 0.25 }, maxStacks: 3 }),
  U('hp3', '巨根之軀', '最大生命 +45', 'epic', 'stat', { statMods: { maxHp: 45 }, maxStacks: 3 }),
  U('regen3', '不竭生機', '每秒回復 +2', 'epic', 'stat', { statMods: { regen: 2 }, maxStacks: 2 }),
]

export const UPGRADE_MAP = new Map(UPGRADES.map(u => [u.id, u]))
