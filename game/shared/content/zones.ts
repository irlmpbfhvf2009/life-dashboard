import type { ZoneData } from '../types'

// 第一版 3 個區域（最終版 5+）。區域 = 怪物池 + 地圖物件 + 視覺/音樂氛圍。
export const ZONES: ZoneData[] = [
  {
    id: 'farm',
    name: '腐爛農場',
    description: '雜草叢生的起點。小怪多、補給也多，適合暖身。',
    enemyPool: [
      { id: 'slug', w: 10 },
      { id: 'gnat', w: 6, fromWave: 2 },
      { id: 'grub', w: 3, fromWave: 3 },
      { id: 'hopper', w: 3, fromWave: 4 },
      { id: 'pickpocket', w: 2, fromWave: 5 },
      { id: 'broodmother', w: 1, fromWave: 6 },
    ],
    props: ['barrel', 'bush', 'healHerb', 'coinBox'],
    propCount: 10,
    bg: { top: '#1a2f1a', bottom: '#0d1a0d', accent: '#7bc043' },
    musicMood: 'farm',
  },
  {
    id: 'mushroom_forest',
    name: '蘑菇森林',
    description: '瀰漫孢子的密林。障礙多、怪物愛包夾，小心毒霧。',
    enemyPool: [
      { id: 'slug', w: 5 },
      { id: 'gnat', w: 5 },
      { id: 'toxicap', w: 5, fromWave: 5 },
      { id: 'boomer', w: 4, fromWave: 5 },
      { id: 'shieldbug', w: 3, fromWave: 5 },
      { id: 'broodmother', w: 2, fromWave: 7 },
    ],
    props: ['mushroom', 'bush', 'healHerb', 'crate'],
    propCount: 14,
    bg: { top: '#241a33', bottom: '#120d1c', accent: '#ba68c8' },
    musicMood: 'forest',
  },
  {
    id: 'ruined_market',
    name: '廢棄市場',
    description: '塌了一半的攤販街。寶箱多、掩體多，但遠程怪也多。',
    enemyPool: [
      { id: 'gnat', w: 5 },
      { id: 'spitter', w: 6, fromWave: 4 },
      { id: 'shieldbug', w: 4, fromWave: 5 },
      { id: 'grub', w: 3 },
      { id: 'pickpocket', w: 3, fromWave: 5 },
      { id: 'hopper', w: 3 },
    ],
    props: ['crate', 'barrel', 'coinBox', 'coinBox'],
    propCount: 12,
    bg: { top: '#2b2016', bottom: '#16100a', accent: '#ff9f43' },
    musicMood: 'market',
  },
]

export const ZONE_MAP = new Map(ZONES.map(z => [z.id, z]))
/** 波次推進的區域輪替（路線選擇可覆寫） */
export const ZONE_ORDER = ['farm', 'mushroom_forest', 'ruined_market']
