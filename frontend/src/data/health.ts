// Types for the Health & Fat-loss module: the onboarding profile and the lean
// daily log (weight + the AI-analysed nutrition entries) that useHealthStore
// persists. Body metrics are derived from the profile in healthPlan.ts.

// ---- Onboarding profile ----
export type Gender = 'male' | 'female'
export type FastingKey = 'none' | '12:12' | '14:10' | '16:8' | '18:6'
export type FastingPlan = Exclude<FastingKey, 'none'>
export type PaceKey = 'steady' | 'moderate' | 'aggressive'
export type BodyPart = 'full' | 'arms' | 'chest' | 'back' | 'abs' | 'legs'

// Selectable intermittent-fasting protocols (shown in onboarding).
export const FASTING_PLANS: FastingPlan[] = ['12:12', '14:10', '16:8', '18:6']
export const PACE_OPTIONS: PaceKey[] = ['steady', 'moderate', 'aggressive']
export const BODY_PARTS: BodyPart[] = ['full', 'arms', 'chest', 'back', 'abs', 'legs']

export interface HealthProfile {
  gender: Gender
  birthday: string // ISO date
  heightCm: number
  weightKg: number
  targetWeightKg: number
  fasting: FastingKey
  pace: PaceKey
  focusAreas: BodyPart[]
  injuries: string // free-text note ("" = none)
  createdAt: string // ISO datetime — day 1
}

export interface WeightPoint { date: string; kg: number } // daily weight log

// ---- AI nutrition log (今日營養) ----

/** One meal / exercise the AI analysed, stored on today's log. No photo is kept. */
export interface FoodEntry {
  id: string
  time: string // HH:mm
  kind: 'food' | 'exercise'
  label: string
  calories: number // food = eaten; exercise = burned
  protein: number
  fiber: number
  carbs: number
  fat: number
  keyNutrients: string[]
  note: string
}

/** The AI's saved daily verdict for today (regenerated on demand). */
export interface NutritionReview {
  balanceScore: number
  verdict: string
  lacking: { nutrient: string; note: string }[]
  suggestions: string[]
  calorieNote: string
}

/**
 * A frozen one-day summary kept in history so the calendar / monthly stats can
 * show past days after the daily log rolls over. One row per logged day.
 */
export interface DailySummary {
  date: string
  entryCount: number
  intake: number // kcal eaten
  burned: number // kcal burned via exercise
  protein: number
  fiber: number
  carbs: number
  fat: number
  balanceScore: number | null // AI verdict for the day, if it was generated
}

/**
 * Lean per-day log. Weight & weight history are cumulative; the AI food log and
 * water are per-day and reset at midnight (rollDaily). Body metrics come from the
 * profile; the day's nutrition comes from the AI-analysed entries below.
 */
export interface HealthLog {
  date: string
  weightKg: number
  startWeightKg: number
  water: number // ml (legacy; kept for back-compat, no longer surfaced)
  waterGoal: number // ml
  weightHistory: WeightPoint[]
  entries: FoodEntry[] // today's AI-analysed meals/exercise
  review: NutritionReview | null // today's AI verdict, if generated
  history: DailySummary[] // frozen past-day summaries for the calendar / monthly stats
}
