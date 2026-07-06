import type { BossData } from '../types'

// 第一版 3 隻 Boss（最終版 8+）。skills 對應 server boss.ts 的 handler id；
// 人數縮放（符文數/毒菇柱數/小怪量）都在 handler 內查 OBJECT_COUNT / PLAYER_SCALING。
export const BOSSES: BossData[] = [
  {
    id: 'onion_king',
    name: '腐爛洋蔥王',
    title: '農場的哭泣暴君',
    baseHp: 900, speed: 55, radius: 52, damage: 16,
    phases: [
      { untilHpPct: 0.66, skills: ['summonMinions', 'poisonRing'], skillInterval: 5 },
      { untilHpPct: 0.33, skills: ['shieldRunes', 'summonMinions', 'poisonRing'], skillInterval: 4.5 },
      { untilHpPct: 0, skills: ['poisonRing', 'summonMinions', 'shieldRunes'], skillInterval: 3.8 },
    ],
    skillParams: {
      summonMinions: { count: 4 },
      poisonRing: { rings: 3, radius: 90, dps: 8, duration: 4 },
      // 符文破盾：玩家站上符文 pad 累積進度；人數決定同時要站的符文數
      shieldRunes: { shieldPct: 0.25, runeRadius: 60, channelTime: 3 },
    },
    summonTable: [{ id: 'slug', w: 3 }, { id: 'gnat', w: 2 }],
    cooperation: '護盾階段：分頭站上發光符文才能破盾（人多要同時站更多個）',
    rewardGold: 60, rewardXp: 80, tier: 'mini',
    palette: ['#c9a86a', '#8a6d3b', '#9ccc65'],
  },
  {
    id: 'mushroom_mother',
    name: '巨型蘑菇母體',
    title: '孢子森林的心臟',
    baseHp: 1400, speed: 38, radius: 60, damage: 14,
    phases: [
      { untilHpPct: 0.6, skills: ['sporeBurst', 'summonSpores'], skillInterval: 5 },
      { untilHpPct: 0.25, skills: ['fogSpread', 'sporeBurst', 'summonSpores'], skillInterval: 4.2 },
      { untilHpPct: 0, skills: ['fogSpread', 'sporeBurst', 'summonSpores'], skillInterval: 3.5 },
    ],
    skillParams: {
      sporeBurst: { bullets: 10, speed: 200, damage: 10 },
      summonSpores: { count: 3 },
      // 毒霧擴散：全場毒化，打掉毒菇柱清出安全區（柱數依人數）
      fogSpread: { fogDps: 6, pillarHp: 60, safeRadius: 150, duration: 10 },
    },
    summonTable: [{ id: 'toxicap', w: 3 }, { id: 'boomer', w: 1 }],
    cooperation: '毒霧全面擴散時，分工打掉毒菇柱清出安全區（人多柱子越多）',
    rewardGold: 100, rewardXp: 140, tier: 'big',
    palette: ['#ba68c8', '#6a2c78', '#9ccc65'],
  },
  {
    id: 'pumpkin_tank',
    name: '鐵皮南瓜戰車',
    title: '廢棄市場的暴走機械',
    baseHp: 1800, speed: 48, radius: 58, damage: 20,
    phases: [
      { untilHpPct: 0.6, skills: ['charge', 'dropBombs'], skillInterval: 5 },
      { untilHpPct: 0.3, skills: ['charge', 'dropBombs', 'summonMinions'], skillInterval: 4.2 },
      { untilHpPct: 0, skills: ['charge', 'charge', 'dropBombs'], skillInterval: 3.6 },
    ],
    skillParams: {
      // 直線衝撞：撞牆自暈 3 秒（暈眩期間正面減傷失效）
      charge: { speed: 420, stunTime: 3, frontDr: 0.6, telegraph: 1.2 },
      dropBombs: { count: 4, radius: 90, damage: 18, fuse: 1.6 },
      summonMinions: { count: 3 },
    },
    summonTable: [{ id: 'hopper', w: 2 }, { id: 'pickpocket', w: 1 }],
    cooperation: '正面幾乎打不動——引它衝撞撞牆暈眩後全力輸出，其他人清小怪救隊友',
    rewardGold: 150, rewardXp: 200, tier: 'big',
    palette: ['#ff9f43', '#b0682a', '#607d8b'],
  },
]

export const BOSS_MAP = new Map(BOSSES.map(b => [b.id, b]))
/** 波次 → Boss 選擇（依區域輪替；無盡模式循環加強） */
export const BOSS_ROTATION: { mini: string[]; big: string[] } = {
  mini: ['onion_king'],
  big: ['mushroom_mother', 'pumpkin_tank'],
}
