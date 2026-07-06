import type { RouteData, TeamRewardData } from '../types'

// 每波結束後 2~3 條路線投票（單人直選）。mods 疊到下一波的 waves.ts 生成參數。
export const ROUTES: RouteData[] = [
  { id: 'r_deep_farm', name: '腐爛農場深處', reward: '金幣掉落 +40%', risk: '小怪數量 +25%', mods: { goldMult: 1.4, enemyCountMult: 1.25 }, weight: 10 },
  { id: 'r_mushroom_path', name: '蘑菇小徑', reward: '稀有升級機率提升', risk: '毒霧地形', mods: { rareChance: 0.5, poisonEdges: true }, weight: 9 },
  { id: 'r_warehouse', name: '廢棄倉庫', reward: '寶箱 +2', risk: '遠程怪增加', mods: { chestMult: 2, rangedBias: 2 }, weight: 9 },
  { id: 'r_elite_nest', name: '菁英巢穴', reward: '必掉稀有寶箱', risk: '本關必出菁英怪', mods: { eliteForce: true, chestMult: 1 }, weight: 7 },
  { id: 'r_merchant', name: '商人營地', reward: '特殊商店（貨更好、有折扣）', risk: '戰鬥獎勵 -30%', mods: { specialShop: true, rewardMult: 0.7 }, weight: 7 },
]

// 第一關固定的小型團隊獎勵（3 選 1，全隊投票）。
export const TEAM_REWARDS: TeamRewardData[] = [
  { id: 'tr_supply', name: '農場補給', description: '全隊回復 30% 生命', effect: 'teamHealPct', params: { pct: 0.3 } },
  { id: 'tr_goldbag', name: '豐收金袋', description: '全隊各獲得 15 金幣', effect: 'teamGold', params: { amount: 15 } },
  { id: 'tr_blessing', name: '老農祝福', description: '下一關掉落率 +50%', effect: 'nextWaveDropBoost', params: { mult: 1.5 } },
  { id: 'tr_parts', name: '武器零件', description: '隨機一名玩家的隨機武器 +1 級', effect: 'randomWeaponUp' },
  { id: 'tr_firstaid', name: '急救包', description: '獲得 1 個復活碎片（集 3 個 = 團隊復活 +1）', effect: 'reviveShard' },
]
