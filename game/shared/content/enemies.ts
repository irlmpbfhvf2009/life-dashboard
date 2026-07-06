import type { EnemyData } from '../types'

// 第一版 10 種怪物（農場害蟲主題）；behavior 決定 enemies.ts 的 AI。
export const ENEMIES: EnemyData[] = [
  {
    id: 'slug', name: '菜蟲', baseHp: 12, speed: 88, damage: 6, radius: 16,
    scoreValue: 10, coinChance: 0.16, xpSize: 1, behavior: 'chase',
    tags: ['basic'], tier: 1, minWave: 1, palette: ['#a5c95a', '#6f8f2f'],
  },
  {
    id: 'gnat', name: '疾風蚊', baseHp: 7, speed: 168, damage: 4, radius: 12,
    scoreValue: 12, coinChance: 0.12, xpSize: 1, behavior: 'fast',
    tags: ['basic', 'fast'], tier: 1, minWave: 2, palette: ['#c9b8ff', '#8a6fd1'],
  },
  {
    id: 'grub', name: '肥滋蠐螬', baseHp: 46, speed: 52, damage: 12, radius: 26,
    scoreValue: 25, coinChance: 0.3, xpSize: 2, behavior: 'tank',
    tags: ['tanky'], tier: 2, minWave: 3, palette: ['#e8d5a3', '#b89b64'],
  },
  {
    id: 'spitter', name: '吐籽鴉', baseHp: 18, speed: 92, damage: 7, radius: 17,
    scoreValue: 22, coinChance: 0.25, xpSize: 2, behavior: 'ranged',
    params: { shootCd: 2.4, shootRange: 340, projSpeed: 240 },
    tags: ['ranged'], tier: 2, minWave: 4, palette: ['#5c6bc0', '#26325e'],
  },
  {
    id: 'boomer', name: '爆爆菇', baseHp: 14, speed: 118, damage: 20, radius: 18,
    scoreValue: 22, coinChance: 0.2, xpSize: 2, behavior: 'exploder',
    params: { fuse: 0.9, blastRadius: 95 },
    tags: ['explosive'], tier: 2, minWave: 5, palette: ['#ef5350', '#8e1f1f'],
  },
  {
    id: 'shieldbug', name: '盾殼蟲', baseHp: 30, speed: 72, damage: 9, radius: 20,
    scoreValue: 26, coinChance: 0.28, xpSize: 2, behavior: 'shielded',
    params: { frontDr: 0.7, arcDeg: 100 },
    tags: ['armored'], tier: 2, minWave: 5, palette: ['#90a4ae', '#455a64'],
  },
  {
    id: 'broodmother', name: '孵蟲母', baseHp: 55, speed: 46, damage: 8, radius: 26,
    scoreValue: 40, coinChance: 0.5, xpSize: 3, behavior: 'summoner',
    params: { summonCd: 5, summonCount: 3 },
    tags: ['summoner'], tier: 3, minWave: 6, palette: ['#ba68c8', '#6a2c78'],
  },
  {
    id: 'toxicap', name: '毒液蛞蝓', baseHp: 22, speed: 80, damage: 8, radius: 18,
    scoreValue: 24, coinChance: 0.22, xpSize: 2, behavior: 'toxic',
    params: { poolRadius: 70, poolDps: 6, poolDuration: 5 },
    tags: ['poison'], tier: 2, minWave: 6, palette: ['#9ccc65', '#33691e'],
  },
  {
    id: 'hopper', name: '彈跳蝗', baseHp: 16, speed: 96, damage: 10, radius: 16,
    scoreValue: 20, coinChance: 0.18, xpSize: 1, behavior: 'lunger',
    params: { lungeCd: 2.6, lungeDist: 190, lungeSpeed: 460 },
    tags: ['fast'], tier: 2, minWave: 4, palette: ['#8bc34a', '#33691e'],
  },
  {
    id: 'pickpocket', name: '扒手鼠', baseHp: 20, speed: 140, damage: 3, radius: 16,
    scoreValue: 30, coinChance: 1.0, xpSize: 1, behavior: 'thief',
    params: { stealAmount: 6, fleeTime: 4 },
    tags: ['thief'], tier: 2, minWave: 5, palette: ['#a1887f', '#4e342e'],
  },
]

export const ENEMY_MAP = new Map(ENEMIES.map(e => [e.id, e]))
/** tier → 生成預算點數 */
export const TIER_COST: Record<number, number> = { 1: 1, 2: 2, 3: 4 }
