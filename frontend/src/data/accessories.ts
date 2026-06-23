// Cosmetic accessories the companion can wear, unlocked by level (the
// gamification payoff on the 養成 tab). Rendered by Creature.vue.

export type AccessoryKey = 'none' | 'party' | 'glasses' | 'bowtie' | 'wreath' | 'tophat' | 'crown'

export interface AccessoryDef {
  key: AccessoryKey
  emoji: string
  unlockLevel: number
}

export const ACCESSORIES: AccessoryDef[] = [
  { key: 'none', emoji: '🚫', unlockLevel: 1 },
  { key: 'party', emoji: '🎉', unlockLevel: 1 },
  { key: 'glasses', emoji: '👓', unlockLevel: 2 },
  { key: 'bowtie', emoji: '🎀', unlockLevel: 3 },
  { key: 'wreath', emoji: '🌿', unlockLevel: 4 },
  { key: 'tophat', emoji: '🎩', unlockLevel: 5 },
  { key: 'crown', emoji: '👑', unlockLevel: 6 },
]

/** Wearable accessories (everything except the "none" slot). */
export const WEARABLES = ACCESSORIES.filter((a) => a.key !== 'none')
