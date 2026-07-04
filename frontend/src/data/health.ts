// Types for the Health & Fat-loss module. The dated training/diet schedule lives
// in fatLossPlan.ts (the "課表" spine); this file only holds the onboarding
// profile and the lean daily log (weight + water) that useHealthStore persists.

import type { AnimalKey } from './animals'
import type { AccessoryKey } from './accessories'

export type OtterMood = 'great' | 'good' | 'tired'

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
  injuries: string // free-text note ("" = none)
  accessory: AccessoryKey // equipped cosmetic ('none' = bare)
  createdAt: string // ISO datetime — day 1
}

export interface WeightPoint { date: string; kg: number } // daily weight log

/**
 * Lean per-day log. Weight & weight history are cumulative; water is per-day and
 * resets at midnight (rollDaily). Everything else the module needs (the daily
 * training/diet actions) comes from the 課表 plan, not from here.
 */
export interface HealthLog {
  date: string
  weightKg: number
  startWeightKg: number
  water: number // ml
  waterGoal: number // ml
  weightHistory: WeightPoint[]
}
