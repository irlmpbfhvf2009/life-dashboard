// Derives body metrics from an onboarding HealthProfile (Mifflin-St Jeor BMR ×
// activity − a pace-sized deficit) and seeds the initial daily log for a new user.

import type { HealthProfile, HealthLog, PaceKey, FoodEntry, DailySummary, NutritionReview } from '@/data/health'

const KCAL_PER_KG = 7700 // ~kcal per kg of body fat
const DEFAULT_ACTIVITY_FACTOR = 1.375 // assume light activity

const PACE_WEEKLY_LOSS: Record<PaceKey, number> = {
  steady: 0.25, moderate: 0.5, aggressive: 0.75,
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
  tdee: number // maintenance calories (BMR × activity) — basis for the daily deficit
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
  return { bmi: Math.round(bmi * 10) / 10, bmiLabel, bmr: Math.round(bmr(p)), tdee: Math.round(tdee), dailyTarget, dailyDeficit: Math.round(dailyDeficit), recommendWaterMl }
}

/** Fresh daily log for a just-onboarded user — weight + an empty nutrition log. */
export function initialLog(p: HealthProfile): HealthLog {
  const today = new Date().toISOString().slice(0, 10)
  return {
    date: today,
    weightKg: p.weightKg,
    startWeightKg: p.weightKg,
    water: 0,
    waterGoal: computeMetrics(p).recommendWaterMl,
    weightHistory: [{ date: today, kg: p.weightKg }],
    entries: [],
    review: null,
    history: [],
  }
}

/** Roll a day's food/exercise entries into a compact summary for history + stats. */
export function summarizeDay(date: string, entries: FoodEntry[], review: NutritionReview | null): DailySummary {
  let intake = 0, burned = 0, protein = 0, fiber = 0, carbs = 0, fat = 0
  for (const e of entries) {
    if (e.kind === 'exercise') { burned += e.calories } else {
      intake += e.calories; protein += e.protein; fiber += e.fiber; carbs += e.carbs; fat += e.fat
    }
  }
  return {
    date,
    entryCount: entries.length,
    intake: Math.round(intake), burned: Math.round(burned),
    protein: Math.round(protein), fiber: Math.round(fiber),
    carbs: Math.round(carbs), fat: Math.round(fat),
    balanceScore: review?.balanceScore ?? null,
  }
}
