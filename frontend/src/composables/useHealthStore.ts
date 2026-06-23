// Per-user health state, persisted to localStorage. This is the ONLY layer that
// touches storage — swapping to a backend later means rewriting just this file
// (load/persist → API calls); the views stay the same.

import { reactive, computed, watch } from 'vue'
import { useAuthStore } from '@/stores/auth'
import type { HealthProfile, HealthPlan, HealthLog } from '@/data/health'
import { generatePlan, initialLog, computeMetrics } from '@/utils/healthPlan'

interface Persisted {
  profile: HealthProfile
  plan: HealthPlan
  log: HealthLog
}

const storageKey = (uid: string) => `health:${uid}`

const state = reactive<{ uid: string | null; data: Persisted | null }>({
  uid: null,
  data: null,
})

function load(uid: string) {
  state.uid = uid
  try {
    const raw = localStorage.getItem(storageKey(uid))
    const parsed = raw ? (JSON.parse(raw) as Persisted) : null
    if (parsed?.log) {
      // Backfill fields added after this user's data was first written.
      const l = parsed.log
      if (l.consumedKcal == null) l.consumedKcal = 0
      if (!l.macros) l.macros = { protein: 0, fat: 0, carb: 0 }
      if (!l.fasting) l.fasting = { active: false, startTs: null }
      if (!l.meals) l.meals = { breakfast: 0, lunch: 0, dinner: 0, snack: 0 }
      if (!l.weightHistory) l.weightHistory = [{ date: l.date, kg: l.weightKg }]
      if (!l.workoutDays) l.workoutDays = []
      // Migrate old cup-based water (goal ≤ 12) to millilitres.
      if (l.waterGoal != null && l.waterGoal <= 12) {
        l.water = (l.water || 0) * 250
        l.waterGoal = 2000
      }
    }
    if (parsed?.profile && !parsed.profile.accessory) {
      parsed.profile.accessory = 'none'
    }
    state.data = parsed
  } catch {
    state.data = null
  }
}

function persist() {
  if (state.uid && state.data) {
    localStorage.setItem(storageKey(state.uid), JSON.stringify(state.data))
  }
}

export function useHealthStore() {
  const auth = useAuthStore()
  const uid = computed(() => auth.firebaseUser?.uid ?? null)

  function ensureLoaded() {
    if (uid.value && state.uid !== uid.value) load(uid.value)
  }
  ensureLoaded()
  watch(uid, ensureLoaded)

  const isOnboarded = computed(() => !!state.data?.profile)
  const profile = computed<HealthProfile | null>(() => state.data?.profile ?? null)
  const plan = computed<HealthPlan | null>(() => state.data?.plan ?? null)
  const log = computed<HealthLog | null>(() => state.data?.log ?? null)

  /** Complete onboarding: build the plan and a fresh zero-state daily log. */
  function onboard(p: HealthProfile) {
    const newPlan = generatePlan(p)
    state.data = { profile: p, plan: newPlan, log: initialLog(p, newPlan) }
    persist()
  }

  /** Edit the profile later: regenerate the plan & water goal, keep the log. */
  function updateProfile(p: HealthProfile) {
    if (!state.data) { onboard(p); return }
    state.data.profile = p
    state.data.plan = generatePlan(p)
    state.data.log.waterGoal = computeMetrics(p).recommendWaterMl
    persist()
  }

  /** Mutate the persisted data in place, then save. */
  function update(mutator: (d: Persisted) => void) {
    if (!state.data) return
    mutator(state.data)
    persist()
  }

  /** Wipe this user's health data (back to onboarding). */
  function reset() {
    if (state.uid) localStorage.removeItem(storageKey(state.uid))
    state.data = null
  }

  return { isOnboarded, profile, plan, log, onboard, updateProfile, update, reset }
}
