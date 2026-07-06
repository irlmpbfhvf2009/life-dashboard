import type { AffixData } from '../types'

// 第一版 8 種詞綴（最終版 20+）；可疊在普通怪或菁英怪身上。
export const AFFIXES: AffixData[] = [
  { id: 'giant', name: '巨大', hpMult: 2.2, sizeMult: 1.5, weight: 100, color: '#ffb74d' },
  { id: 'frenzied', name: '狂暴', speedMult: 1.35, damageMult: 1.3, weight: 90, color: '#ef5350' },
  { id: 'armored', name: '裝甲', damageReduction: 0.35, weight: 90, color: '#90a4ae' },
  { id: 'splitting', name: '分裂', onDeath: 'split', weight: 70, color: '#ba68c8' },
  { id: 'venomtrail', name: '毒霧', trail: 'poison', weight: 70, color: '#9ccc65' },
  { id: 'warded', name: '護盾', periodicShield: 6, weight: 60, color: '#4fc3f7' },
  { id: 'volatile', name: '爆裂', onDeath: 'explode', weight: 80, color: '#ff7043' },
  { id: 'stalker', name: '追獵', targetLowestHp: true, speedMult: 1.15, weight: 60, color: '#f06292' },
]

export const AFFIX_MAP = new Map(AFFIXES.map(a => [a.id, a]))
