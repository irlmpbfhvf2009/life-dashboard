// Mock data for the Health & Fat-loss module. Shapes mirror the planned Spring
// Boot DTOs so views can later swap to real API calls with minimal change.
// No wearable/sensor data — recovery is driven by a simple self check-in.

import type { AnimalKey } from './animals'
import type { AccessoryKey } from './accessories'

export type Level3 = 1 | 2 | 3 // low / mid / high
export type OtterMood = 'great' | 'good' | 'tired'

// ---- Onboarding profile & generated plan ----
export type Gender = 'male' | 'female'
export type FastingKey = 'none' | '12:12' | '14:10' | '16:8' | '18:6'
export type FastingPlan = Exclude<FastingKey, 'none'>
export type PaceKey = 'steady' | 'moderate' | 'aggressive'
export type BodyPart = 'full' | 'arms' | 'chest' | 'back' | 'abs' | 'legs'

// Selectable intermittent-fasting protocols (shown in the fasting card).
export const FASTING_PLANS: FastingPlan[] = ['12:12', '14:10', '16:8', '18:6']
export const PACE_OPTIONS: PaceKey[] = ['steady', 'moderate', 'aggressive']
export const BODY_PARTS: BodyPart[] = ['full', 'arms', 'chest', 'back', 'abs', 'legs']

export interface HealthProfile {
  animal: AnimalKey
  companionName: string
  gender: Gender
  birthday: string // ISO date
  heightCm: number
  weightKg: number
  targetWeightKg: number
  fasting: FastingKey
  pace: PaceKey
  focusAreas: BodyPart[]
  injuries: string // free-text note ("" = none) — feeds workout recommendations
  accessory: AccessoryKey // equipped cosmetic ('none' = bare)
  createdAt: string // ISO datetime — day 1 of the plan
}

export interface PlanHabit {
  key: string // i18n key under health.habitNames.*
  emoji: string
}

export interface HealthPlan {
  weeks: number
  sessionsPerWeek: number
  minutesPerSession: number
  fastingWindow: FastingKey
  eatingWindow: string // "12:00 – 20:00"
  dailyCalorieTarget: number
  weeklyLossKg: number
  habits: PlanHabit[]
}

// Live per-day log (seeded fresh for new users; persisted locally).
export interface HabitLog { id: number; emoji: string; key: string; done: boolean; streak: number }
export interface FastingState { active: boolean; startTs: number | null }
export interface Macros { protein: number; fat: number; carb: number } // grams
export interface WeightPoint { date: string; kg: number } // daily weight log
export interface BurnPoint { date: string; kcal: number } // daily workout burn
export type MealKey = 'breakfast' | 'lunch' | 'dinner' | 'snack'
export type Meals = Record<MealKey, number> // kcal logged per meal
export const MEAL_KEYS: MealKey[] = ['breakfast', 'lunch', 'dinner', 'snack']
// Share of the daily calorie target per meal (used for "recommended" ranges).
export const MEAL_SHARE: Record<MealKey, number> = { breakfast: 0.25, lunch: 0.35, dinner: 0.25, snack: 0.15 }

export interface HealthLog {
  date: string
  weightKg: number
  startWeightKg: number
  water: number // ml
  waterGoal: number // ml
  workouts: WorkoutEntry[]
  habits: HabitLog[]
  xp: number
  level: number
  xpToNext: number
  stress: Level3
  energy: Level3
  fasting: FastingState
  consumedKcal: number
  macros: Macros
  meals: Meals
  weightHistory: WeightPoint[]
  workoutDays: BurnPoint[]
}

export interface RecoveryToday {
  // Self-reported, 1-3. Recovery score is derived from these.
  stress: Level3
  energy: Level3
}

export interface OtterState {
  level: number
  xp: number
  xpToNext: number
}

export interface HabitItem {
  id: number
  name: string // already-localised label is fine for mock; real data would key this
  emoji: string
  done: boolean
  streak: number
}

export interface WorkoutPreset {
  key: string
  emoji: string
  label: string
  kcalPerMin: number
  defaultMin: number
}

export interface WorkoutEntry {
  id: number
  emoji: string
  key: string // i18n key under health.workoutNames.*
  minutes: number
  kcal: number
  time: string // HH:mm
}

export interface WaterToday {
  done: number
  goal: number
}

export interface WeightInfo {
  current: number
  target: number
  start: number
  trend: { date: string; weight: number }[]
}

// Workout presets for the quick-add chips. Labels are localised at render via
// health.workoutNames.<key>; the `label` here is a zh-TW fallback.
export const workoutPresets: WorkoutPreset[] = [
  { key: 'walk', emoji: '👟', label: '走路', kcalPerMin: 4, defaultMin: 30 },
  { key: 'run', emoji: '🏃', label: '跑步', kcalPerMin: 11, defaultMin: 25 },
  { key: 'strength', emoji: '🏋️', label: '重訓', kcalPerMin: 7, defaultMin: 40 },
  { key: 'yoga', emoji: '🧘', label: '瑜伽', kcalPerMin: 4, defaultMin: 30 },
  { key: 'bike', emoji: '🚴', label: '騎車', kcalPerMin: 8, defaultMin: 30 },
  { key: 'swim', emoji: '🏊', label: '游泳', kcalPerMin: 9, defaultMin: 30 },
]
