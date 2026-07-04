// Per-user fat-loss training plan ("減脂課表"). localStorage is the immediate
// cache (synchronous, offline-safe); the backend (/api/plan/state) is a
// background sync layer so the plan follows the user across devices. Backend
// failures degrade silently. Module-scope singleton — state survives route
// changes. Mirrors useEnglishStore.

import { computed, reactive, watch } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { planStateApi } from '@/api'
import {
  defaultFatLossPlan, buildPlan, type PlanGoal, type TrainingPlan, type PlanDay,
} from '@/data/fatLossPlan'

const storageKey = (uid: string) => `plan:${uid}`

const state = reactive<{ uid: string | null; data: TrainingPlan | null }>({ uid: null, data: null })

let pulledForUid: string | null = null
let pushTimer: ReturnType<typeof setTimeout> | undefined

/**
 * Rebuild the plan deterministically from its (goal, startDate, weeks) so day
 * content always matches the current templates, while preserving the user's
 * completion checkboxes by date. Handles migration from older documents that
 * predate goal/weeks fields.
 */
function normalize(p: TrainingPlan): TrainingPlan {
  if (!p || !Array.isArray(p.days) || p.days.length === 0) return defaultFatLossPlan()
  const goal: PlanGoal = p.goal ?? 'cut'
  const startDate = p.startDate ?? p.days[0].date
  const weeks = p.weeks ?? Math.ceil(p.days.length / 7)
  const rebuilt = buildPlan(goal, startDate, weeks)
  const doneByDate = new Map(p.days.map((d) => [d.date, d.done]))
  rebuilt.days = rebuilt.days.map((d): PlanDay => ({ ...d, done: { ...d.done, ...(doneByDate.get(d.date) ?? {}) } }))
  return rebuilt
}

function load(uid: string) {
  state.uid = uid
  try {
    const raw = localStorage.getItem(storageKey(uid))
    state.data = raw ? normalize(JSON.parse(raw) as TrainingPlan) : defaultFatLossPlan()
  } catch {
    state.data = defaultFatLossPlan()
  }
}

function persist() {
  if (!state.uid || !state.data) return
  localStorage.setItem(storageKey(state.uid), JSON.stringify(state.data))
  schedulePush()
}

/** Debounced push of the full plan document to the backend. */
function schedulePush() {
  if (!state.uid) return
  clearTimeout(pushTimer)
  pushTimer = setTimeout(() => {
    if (state.uid && state.data) planStateApi.put(state.data).catch(() => undefined)
  }, 1500)
}

export function usePlan() {
  const auth = useAuthStore()
  const uid = computed(() => auth.firebaseUser?.uid ?? null)

  function ensureLoaded() {
    if (uid.value && state.uid !== uid.value) load(uid.value)
    if (uid.value) void pullOnce(uid.value)
  }

  /**
   * Pull the cloud plan once per uid. If the cloud has one, it wins (replaces the
   * local cache); if not, push the current local plan up so the account is
   * seeded. Failures are swallowed so the app keeps working on localStorage.
   */
  async function pullOnce(targetUid: string) {
    if (pulledForUid === targetUid) return
    pulledForUid = targetUid
    try {
      const remote = await planStateApi.get<TrainingPlan>()
      if (state.uid !== targetUid) return
      if (remote && typeof remote === 'object' && Array.isArray((remote as TrainingPlan).days)) {
        state.data = normalize(remote as TrainingPlan)
        localStorage.setItem(storageKey(targetUid), JSON.stringify(state.data))
      } else if (state.data) {
        planStateApi.put(state.data).catch(() => undefined)
      }
    } catch {
      pulledForUid = null // allow a retry on the next interaction
    }
  }

  ensureLoaded()
  watch(uid, ensureLoaded)

  const plan = computed<TrainingPlan | null>(() => state.data)

  const todayISO = new Date(Date.now() - new Date().getTimezoneOffset() * 60000)
    .toISOString().slice(0, 10)
  /** Today's day in the plan (or null if today is outside the plan window). */
  const todayDay = computed<PlanDay | null>(() => state.data?.days.find((d) => d.date === todayISO) ?? null)

  /** Overall completion 0–100 across all 4 slots × all days. */
  const progressPct = computed(() => {
    const d = state.data
    if (!d) return 0
    const total = d.days.length * 4
    if (!total) return 0
    let done = 0
    for (const day of d.days) {
      done += (day.done.am ? 1 : 0) + (day.done.meal1 ? 1 : 0) + (day.done.gym ? 1 : 0) + (day.done.meal2 ? 1 : 0)
    }
    return Math.round((done / total) * 100)
  })

  /** Number of days where all 4 slots are checked. */
  const perfectDays = computed(() => {
    const d = state.data
    if (!d) return 0
    return d.days.filter((day) => day.done.am && day.done.meal1 && day.done.gym && day.done.meal2).length
  })

  function update(mutator: (p: TrainingPlan) => void) {
    if (!state.data) return
    mutator(state.data)
    persist()
  }

  /** Toggle one completion checkbox for a given date. */
  function toggle(date: string, slot: keyof PlanDay['done']) {
    update((p) => {
      const day = p.days.find((x) => x.date === date)
      if (day) day.done[slot] = !day.done[slot]
    })
  }

  /** Reset to the default 2026/7 plan (wipes completion). */
  function resetToDefault() {
    state.data = defaultFatLossPlan()
    persist()
  }

  /** Regenerate the plan from a chosen goal template, start date and weeks. */
  function regenerate(goal: PlanGoal, startDate: string, weeks: number) {
    state.data = buildPlan(goal, startDate, weeks)
    persist()
  }

  /** Clear only the completion checkboxes, keep the plan content. */
  function clearChecks() {
    update((p) => {
      for (const day of p.days) day.done = { am: false, meal1: false, gym: false, meal2: false }
    })
  }

  return { plan, todayDay, progressPct, perfectDays, toggle, resetToDefault, regenerate, clearChecks }
}
