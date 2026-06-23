// Turns an onboarding HealthProfile into a personalised HealthPlan, plus the
// initial daily log for a brand-new user. Science-lite & approximate —
// Mifflin-St Jeor BMR × activity factor − a deficit sized by the chosen pace.
// Training intensity & diet are no longer asked in onboarding; sensible
// defaults are used and the workout page refines them later.

import type {
  HealthProfile, HealthPlan, HealthLog, PlanHabit, PaceKey, FastingKey,
} from '@/data/health'

const KCAL_PER_KG = 7700 // ~kcal per kg of body fat
const DEFAULT_ACTIVITY_FACTOR = 1.375 // assume light activity until the workout page says otherwise
const DEFAULT_SESSION_MINUTES = 30

const PACE_WEEKLY_LOSS: Record<PaceKey, number> = {
  steady: 0.25, moderate: 0.5, aggressive: 0.75,
}
const PACE_SESSIONS: Record<PaceKey, number> = {
  steady: 3, moderate: 4, aggressive: 5,
}

/** Total fasting hours for a protocol (the "16" in 16:8). */
export function fastHours(window: FastingKey): number {
  return window === '12:12' ? 12 : window === '14:10' ? 14 : window === '18:6' ? 18 : 16
}

export interface FastingStage { key: string; from: number; to: number }
// Glucose/metabolic phases over a fast (hours). Matches the OtterLife dashboard.
export const FASTING_STAGES: FastingStage[] = [
  { key: 'rising', from: 0, to: 2 },
  { key: 'falling', from: 2, to: 4 },
  { key: 'stable', from: 4, to: 8 },
  { key: 'switching', from: 8, to: 12 },
  { key: 'burning', from: 12, to: 16 },
]

export function stageForElapsed(hours: number): FastingStage {
  return FASTING_STAGES.find((s) => hours < s.to) ?? FASTING_STAGES[FASTING_STAGES.length - 1]
}

export function ageFromBirthday(iso: string): number {
  if (!iso) return 30
  const b = new Date(iso)
  if (Number.isNaN(b.getTime())) return 30
  const now = new Date()
  let age = now.getFullYear() - b.getFullYear()
  const m = now.getMonth() - b.getMonth()
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) age--
  return Math.min(100, Math.max(13, age))
}

function bmr(p: HealthProfile): number {
  const age = ageFromBirthday(p.birthday)
  const base = 10 * p.weightKg + 6.25 * p.heightCm - 5 * age
  return p.gender === 'male' ? base + 5 : base - 161
}

export interface HealthMetrics {
  bmi: number
  bmiLabel: 'under' | 'normal' | 'over' | 'obese'
  bmr: number
  dailyTarget: number
  dailyDeficit: number
  recommendWaterMl: number
}

/** Body metrics derived from the profile — shown on the 今日 metrics card. */
export function computeMetrics(p: HealthProfile): HealthMetrics {
  const h = p.heightCm / 100
  const bmi = h > 0 ? p.weightKg / (h * h) : 0
  const bmiLabel = bmi < 18.5 ? 'under' : bmi < 24 ? 'normal' : bmi < 27 ? 'over' : 'obese'
  const tdee = bmr(p) * DEFAULT_ACTIVITY_FACTOR
  const dailyDeficit = (PACE_WEEKLY_LOSS[p.pace] * KCAL_PER_KG) / 7
  const floor = p.gender === 'male' ? 1500 : 1200
  const dailyTarget = Math.max(floor, Math.round((tdee - dailyDeficit) / 10) * 10)
  const recommendWaterMl = Math.min(3500, Math.max(1500, Math.round((p.weightKg * 33) / 50) * 50))
  return { bmi: Math.round(bmi * 10) / 10, bmiLabel, bmr: Math.round(bmr(p)), dailyTarget, dailyDeficit: Math.round(dailyDeficit), recommendWaterMl }
}

/** Suggested eating window for a fasting protocol (last meal ~20:00). */
export function eatingWindow(fasting: FastingKey): string {
  if (fasting === 'none') return '—'
  const eatHours = fasting === '12:12' ? 12 : fasting === '14:10' ? 10 : fasting === '16:8' ? 8 : 6
  const end = 20
  const start = (end - eatHours + 24) % 24
  const fmt = (h: number) => `${String(h).padStart(2, '0')}:00`
  return `${fmt(start)} – ${fmt(end)}`
}

function buildHabits(p: HealthProfile): PlanHabit[] {
  const out: PlanHabit[] = [
    { key: 'water', emoji: '💧' },
    { key: 'workout', emoji: '🏃' },
    { key: 'steps', emoji: '👟' },
    { key: 'protein', emoji: '🍗' },
    { key: 'stretch', emoji: '🧘' },
  ]
  if (p.fasting !== 'none') out.splice(3, 0, { key: 'fasting', emoji: '⏱️' })
  return out
}

export function generatePlan(p: HealthProfile): HealthPlan {
  const weeklyLoss = PACE_WEEKLY_LOSS[p.pace]
  const toLose = Math.max(0, p.weightKg - p.targetWeightKg)
  const weeks = toLose > 0 ? Math.max(1, Math.ceil(toLose / weeklyLoss)) : 4

  const tdee = bmr(p) * DEFAULT_ACTIVITY_FACTOR
  const dailyDeficit = (weeklyLoss * KCAL_PER_KG) / 7
  const floor = p.gender === 'male' ? 1500 : 1200
  const dailyCalorieTarget = Math.max(floor, Math.round((tdee - dailyDeficit) / 10) * 10)

  return {
    weeks,
    sessionsPerWeek: PACE_SESSIONS[p.pace],
    minutesPerSession: DEFAULT_SESSION_MINUTES,
    fastingWindow: p.fasting,
    eatingWindow: eatingWindow(p.fasting),
    dailyCalorieTarget,
    weeklyLossKg: weeklyLoss,
    habits: buildHabits(p),
  }
}

/** Fresh daily log for a just-onboarded user — starts from zero, no mock. */
export function initialLog(p: HealthProfile, plan: HealthPlan): HealthLog {
  const today = new Date().toISOString().slice(0, 10)
  return {
    date: today,
    weightKg: p.weightKg,
    startWeightKg: p.weightKg,
    water: 0,
    waterGoal: computeMetrics(p).recommendWaterMl,
    workouts: [],
    habits: plan.habits.map((h, i) => ({ id: i + 1, emoji: h.emoji, key: h.key, done: false, streak: 0 })),
    xp: 0,
    level: 1,
    xpToNext: 100,
    stress: 2,
    energy: 2,
    fasting: { active: false, startTs: null },
    consumedKcal: 0,
    macros: { protein: 0, fat: 0, carb: 0 },
    meals: { breakfast: 0, lunch: 0, dinner: 0, snack: 0 },
    weightHistory: [{ date: today, kg: p.weightKg }],
    workoutDays: [],
  }
}
