import type { MissionData } from '../types'

// 第一版 10 種任務目標（最終版 25+）。全部支援 1~4 人（count 乘倍率 / objects 查機關數表）。
export const MISSIONS: MissionData[] = [
  { id: 'm_survive', type: 'survive', name: '堅守陣地', descTemplate: '撐過這一波的怪物攻勢', baseTarget: 1, scalingMode: 'count', rewards: ['gold'], minWave: 1 },
  { id: 'm_kills', type: 'kills', name: '除蟲行動', descTemplate: '擊殺 {n} 隻怪物', baseTarget: 30, scalingMode: 'count', rewards: ['gold', 'teamHeal'], minWave: 4 },
  { id: 'm_elite', type: 'elite', name: '獵殺菁英', descTemplate: '擊殺 {n} 隻菁英怪', baseTarget: 1, scalingMode: 'count', rewards: ['chest'], minWave: 6 },
  { id: 'm_crystal', type: 'crystal', name: '保護水晶', descTemplate: '別讓農場水晶被打爆', baseTarget: 1, scalingMode: 'count', rewards: ['freeUpgrade'], minWave: 5 },
  { id: 'm_cart', type: 'cart', name: '護送菜車', descTemplate: '跟著菜車走完全程（靠近才會前進）', baseTarget: 1, scalingMode: 'count', rewards: ['gold', 'shopDiscount'], minWave: 6 },
  { id: 'm_points', type: 'points', name: '搶佔田埂', descTemplate: '同時站上 {n} 個發光田埂數秒', baseTarget: 1, scalingMode: 'objects', rewards: ['gold', 'rareBoost'], minWave: 5 },
  { id: 'm_orbs', type: 'orbs', name: '收集能量球', descTemplate: '撿取 {n} 顆掉落的能量球', baseTarget: 8, scalingMode: 'count', rewards: ['freeUpgrade'], minWave: 4 },
  { id: 'm_nests', type: 'nests', name: '搗毀蟲巢', descTemplate: '破壞 {n} 個怪物巢穴（會持續生怪）', baseTarget: 2, scalingMode: 'objects', rewards: ['gold', 'chest'], minWave: 6 },
  { id: 'm_base', type: 'base', name: '防守糧倉', descTemplate: '守住糧倉直到本波結束', baseTarget: 1, scalingMode: 'count', rewards: ['gold', 'teamHeal'], minWave: 7 },
  { id: 'm_chestguard', type: 'chestGuard', name: '看守寶箱', descTemplate: '打開寶箱後守住 20 秒', baseTarget: 20, scalingMode: 'count', rewards: ['chest', 'reviveShard'], minWave: 7 },
]

export const MISSION_MAP = new Map(MISSIONS.map(m => [m.id, m]))
