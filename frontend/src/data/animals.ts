// Companion animals the user can pick during onboarding. Each drives the
// parametric mascot SVG (Creature.vue). Colours are intrinsic (not themed).

export type AnimalKey = 'otter' | 'cat' | 'shiba' | 'rabbit' | 'bear'
export type EarType = 'round' | 'triangle' | 'long'

export interface AnimalDef {
  key: AnimalKey
  emoji: string
  defaultName: string // suggested companion name (zh-TW); user can rename
  body: string
  ear: string
  innerEar: string
  snout: string
  nose: string
  whiskers: boolean
  earType: EarType
}

export const ANIMALS: AnimalDef[] = [
  { key: 'otter',  emoji: '🦦', defaultName: '小獺', body: '#a3724a', ear: '#8a5e36', innerEar: '#caa06f', snout: '#f5e6d0', nose: '#5b3b22', whiskers: true,  earType: 'round' },
  { key: 'cat',    emoji: '🐱', defaultName: '小貓', body: '#9aa3ad', ear: '#9aa3ad', innerEar: '#f4b8c1', snout: '#e8edf1', nose: '#e0667e', whiskers: true,  earType: 'triangle' },
  { key: 'shiba',  emoji: '🐕', defaultName: '柴柴', body: '#e0a86a', ear: '#c98f50', innerEar: '#f5e0c5', snout: '#faf1e2', nose: '#5b3b22', whiskers: false, earType: 'triangle' },
  { key: 'rabbit', emoji: '🐰', defaultName: '兔兔', body: '#e7e4ea', ear: '#e7e4ea', innerEar: '#f4b8c1', snout: '#faf8fb', nose: '#e0667e', whiskers: true,  earType: 'long' },
  { key: 'bear',   emoji: '🐻', defaultName: '小熊', body: '#8a6646', ear: '#6f4f34', innerEar: '#b08d6a', snout: '#e9d8c4', nose: '#3f2a1a', whiskers: false, earType: 'round' },
]

export function animalDef(key: AnimalKey): AnimalDef {
  return ANIMALS.find((a) => a.key === key) ?? ANIMALS[0]
}
