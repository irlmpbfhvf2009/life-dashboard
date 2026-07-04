// Per-user health doc (profile + lean daily log). localStorage is the immediate,
// offline-safe cache; the backend (/api/health/state) is a background sync layer
// so the data follows the user across devices. Backend failures degrade silently.
// Module-scope singleton. Mirrors usePlan / useEnglishStore.

import { reactive, computed, watch } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { healthStateApi } from '@/api'
import type { HealthProfile, HealthLog } from '@/data/health'
import { initialLog, computeMetrics } from '@/utils/healthPlan'

interface Persisted {
  profile: HealthProfile
  log: HealthLog
}

const storageKey = (uid: string) => `health:${uid}`

const state = reactive<{ uid: string | null; data: Persisted | null }>({
  uid: null,
  data: null,
})

let pulledForUid: string | null = null
let pushTimer: ReturnType<typeof setTimeout> | undefined

const todayKey = () =>
  new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10)

/** Migrate/backfill a loaded doc from older (bloated) schemas to the lean shape. */
function normalize(data: Persisted | null): Persisted | null {
  if (!data?.profile || !data?.log) return null
  const l = data.log as HealthLog & Record<string, unknown>
  if (!l.weightHistory) l.weightHistory = [{ date: l.date, kg: l.weightKg }]
  if (l.waterGoal == null) l.waterGoal = computeMetrics(data.profile).recommendWaterMl
  // Migrate old cup-based water (goal ≤ 12) to millilitres.
  if (l.waterGoal <= 12) {
    l.water = (l.water || 0) * 250
    l.waterGoal = 2000
  }
  if (data.profile.accessory == null) data.profile.accessory = 'none'
  return { profile: data.profile, log: data.log }
}

function load(uid: string) {
  state.uid = uid
  try {
    const raw = localStorage.getItem(storageKey(uid))
    state.data = raw ? normalize(JSON.parse(raw) as Persisted) : null
  } catch {
    state.data = null
  }
}

function persist() {
  if (!state.uid || !state.data) return
  localStorage.setItem(storageKey(state.uid), JSON.stringify(state.data))
  schedulePush()
}

/** Debounced push of the full health doc to the backend. */
function schedulePush() {
  if (!state.uid) return
  clearTimeout(pushTimer)
  pushTimer = setTimeout(() => {
    if (state.uid && state.data) healthStateApi.put(state.data).catch(() => undefined)
  }, 1500)
}

/**
 * Roll the daily log over to today: water is per-day and resets at midnight.
 * Weight, weight history and goals are cumulative and carried forward. Runs on
 * every load/mount. Returns true if it changed anything (so callers persist).
 */
function rollDaily(): boolean {
  const l = state.data?.log
  if (!l) return false
  const today = todayKey()
  if (l.date === today) return false
  l.date = today
  l.water = 0
  return true
}

export function useHealthStore() {
  const auth = useAuthStore()
  const uid = computed(() => auth.firebaseUser?.uid ?? null)

  /**
   * Pull the cloud doc once per uid. If the cloud has one, it wins (replaces the
   * local cache); if not but we have a local doc, push it up to seed the account.
   * Failures are swallowed so the app keeps working on localStorage.
   */
  async function pullOnce(targetUid: string) {
    if (pulledForUid === targetUid) return
    pulledForUid = targetUid
    try {
      const remote = await healthStateApi.get<Persisted>()
      if (state.uid !== targetUid) return
      const norm = normalize(remote as Persisted | null)
      if (norm) {
        if (rollDailyOn(norm)) { /* rolled */ }
        state.data = norm
        localStorage.setItem(storageKey(targetUid), JSON.stringify(norm))
      } else if (state.data) {
        healthStateApi.put(state.data).catch(() => undefined)
      }
    } catch {
      pulledForUid = null // allow a retry on the next interaction
    }
  }

  function rollDailyOn(d: Persisted): boolean {
    const today = todayKey()
    if (d.log.date === today) return false
    d.log.date = today
    d.log.water = 0
    return true
  }

  function ensureLoaded() {
    if (uid.value && state.uid !== uid.value) load(uid.value)
    if (rollDaily()) persist()
    if (uid.value) void pullOnce(uid.value)
  }
  ensureLoaded()
  watch(uid, ensureLoaded)

  const isOnboarded = computed(() => !!state.data?.profile)
  const profile = computed<HealthProfile | null>(() => state.data?.profile ?? null)
  const log = computed<HealthLog | null>(() => state.data?.log ?? null)

  /** Complete onboarding: seed a fresh zero-state daily log. */
  function onboard(p: HealthProfile) {
    state.data = { profile: p, log: initialLog(p) }
    persist()
  }

  /** Edit the profile later: recompute the water goal, keep the log. */
  function updateProfile(p: HealthProfile) {
    if (!state.data) { onboard(p); return }
    state.data.profile = p
    state.data.log.waterGoal = computeMetrics(p).recommendWaterMl
    persist()
  }

  /** Mutate the persisted data in place, then save. */
  function update(mutator: (d: Persisted) => void) {
    if (!state.data) return
    mutator(state.data)
    persist()
  }

  /** Wipe this user's local health cache (back to onboarding). Cloud is overwritten on next edit. */
  function reset() {
    if (state.uid) localStorage.removeItem(storageKey(state.uid))
    state.data = null
    pulledForUid = null
  }

  return { isOnboarded, profile, log, onboard, updateProfile, update, reset }
}
