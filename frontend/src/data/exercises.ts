// Curated exercise suggestions for the 健身 tab. We deliberately do NOT clone
// OtterLife's huge illustrated move library — just a small, useful set filtered
// by body part and equipment. zh-TW labels inline (i18n later).

import type { BodyPart } from './health'

export interface Exercise {
  id: string
  label: string // zh-TW
  emoji: string
  bodyPart: BodyPart
  noEquip: boolean // true = bodyweight, no equipment
  kcalPerMin: number
  defaultMin: number
}

export const EXERCISES: Exercise[] = [
  // 全身
  { id: 'squat-jump', label: '深蹲跳', emoji: '🦵', bodyPart: 'full', noEquip: true, kcalPerMin: 9, defaultMin: 10 },
  { id: 'jumping-jack', label: '開合跳', emoji: '🤸', bodyPart: 'full', noEquip: true, kcalPerMin: 8, defaultMin: 10 },
  { id: 'burpee', label: '波比跳', emoji: '🔥', bodyPart: 'full', noEquip: true, kcalPerMin: 11, defaultMin: 8 },
  { id: 'mountain-climber', label: '登山者', emoji: '⛰️', bodyPart: 'full', noEquip: true, kcalPerMin: 9, defaultMin: 10 },
  // 手臂
  { id: 'biceps-curl', label: '啞鈴二頭彎舉', emoji: '💪', bodyPart: 'arms', noEquip: false, kcalPerMin: 5, defaultMin: 12 },
  { id: 'triceps-dip', label: '三頭撐體', emoji: '🪑', bodyPart: 'arms', noEquip: true, kcalPerMin: 6, defaultMin: 10 },
  { id: 'diamond-pushup', label: '窄距伏地挺身', emoji: '🔺', bodyPart: 'arms', noEquip: true, kcalPerMin: 7, defaultMin: 8 },
  // 胸部
  { id: 'pushup', label: '伏地挺身', emoji: '🙇', bodyPart: 'chest', noEquip: true, kcalPerMin: 7, defaultMin: 10 },
  { id: 'dumbbell-press', label: '啞鈴臥推', emoji: '🏋️', bodyPart: 'chest', noEquip: false, kcalPerMin: 6, defaultMin: 12 },
  { id: 'chest-fly', label: '啞鈴飛鳥', emoji: '🕊️', bodyPart: 'chest', noEquip: false, kcalPerMin: 5, defaultMin: 12 },
  // 背部
  { id: 'dumbbell-row', label: '啞鈴划船', emoji: '🚣', bodyPart: 'back', noEquip: false, kcalPerMin: 6, defaultMin: 12 },
  { id: 'superman', label: '超人式', emoji: '🦸', bodyPart: 'back', noEquip: true, kcalPerMin: 5, defaultMin: 8 },
  { id: 'pullup', label: '引體向上', emoji: '🧗', bodyPart: 'back', noEquip: false, kcalPerMin: 8, defaultMin: 8 },
  // 腹部
  { id: 'crunch', label: '捲腹', emoji: '🌀', bodyPart: 'abs', noEquip: true, kcalPerMin: 5, defaultMin: 10 },
  { id: 'plank', label: '棒式', emoji: '📏', bodyPart: 'abs', noEquip: true, kcalPerMin: 4, defaultMin: 8 },
  { id: 'leg-raise', label: '抬腿', emoji: '🦿', bodyPart: 'abs', noEquip: true, kcalPerMin: 5, defaultMin: 10 },
  // 腿部
  { id: 'squat', label: '深蹲', emoji: '🦵', bodyPart: 'legs', noEquip: true, kcalPerMin: 7, defaultMin: 12 },
  { id: 'lunge', label: '弓步蹲', emoji: '🚶', bodyPart: 'legs', noEquip: true, kcalPerMin: 7, defaultMin: 12 },
  { id: 'glute-bridge', label: '臀橋', emoji: '🌉', bodyPart: 'legs', noEquip: true, kcalPerMin: 5, defaultMin: 10 },
]
