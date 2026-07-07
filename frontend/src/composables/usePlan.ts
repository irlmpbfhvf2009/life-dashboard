// Per-user fat-loss training plan ("減脂課表"). Cloud sync plumbing lives in
// useCloudSyncStore; this file only owns the plan shape, deterministic
// rebuild-from-template and the plan-specific derived stats/actions.

import { computed } from 'vue'
import { planStateApi } from '@/api'
import {
  defaultFatLossPlan, buildPlan, type PlanGoal, type TrainingPlan, type PlanDay,
} from '@/data/fatLossPlan'
import { useCloudSyncStore } from './useCloudSyncStore'

/**
 * Rebuild the plan deterministically from its (goal, startDate, weeks) so day
 * content always matches the current templates, while preserving the user's
 * completion checkboxes by date. Handles migration from older documents that
 * predate goal/weeks fields. Returns null when there's nothing usable (e.g.
 * no cloud doc yet) so the caller can decide whether to fall back to a fresh
 * default plan or push the local one up.
 */
function normalize(p: TrainingPlan | null | undefined): TrainingPlan | null {
  if (!p || typeof p !== 'object' || !Array.isArray(p.days) || p.days.length === 0) return null
  const goal: PlanGoal = p.goal ?? 'cut'
  const startDate = p.startDate ?? p.days[0].date
  const weeks = p.weeks ?? Math.ceil(p.days.length / 7)
  const rebuilt = buildPlan(goal, startDate, weeks)
  const doneByDate = new Map(p.days.map((d) => [d.date, d.done]))
  rebuilt.days = rebuilt.days.map((d): PlanDay => ({ ...d, done: { ...d.done, ...(doneByDate.get(d.date) ?? {}) } }))
  return rebuilt
}

export function usePlan() {
  const cloud = useCloudSyncStore<TrainingPlan>({
    namespace: 'plan',
    api: planStateApi,
    createDefault: defaultFatLossPlan,
    normalize,
  })

  const plan = computed<TrainingPlan | null>(() => cloud.data.value)

  const todayISO = new Date(Date.now() - new Date().getTimezoneOffset() * 60000)
    .toISOString().slice(0, 10)
  /** Today's day in the plan (or null if today is outside the plan window). */
  const todayDay = computed<PlanDay | null>(() => cloud.data.value?.days.find((d) => d.date === todayISO) ?? null)

  /** Overall completion 0–100 across all 4 slots × all days. */
  const progressPct = computed(() => {
    const d = cloud.data.value
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
    const d = cloud.data.value
    if (!d) return 0
    return d.days.filter((day) => day.done.am && day.done.meal1 && day.done.gym && day.done.meal2).length
  })

  function update(mutator: (p: TrainingPlan) => void) {
    cloud.update(mutator)
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
    cloud.replace(defaultFatLossPlan())
  }

  /** Regenerate the plan from a chosen goal template, start date and weeks. */
  function regenerate(goal: PlanGoal, startDate: string, weeks: number) {
    cloud.replace(buildPlan(goal, startDate, weeks))
  }

  /** Clear only the completion checkboxes, keep the plan content. */
  function clearChecks() {
    update((p) => {
      for (const day of p.days) day.done = { am: false, meal1: false, gym: false, meal2: false }
    })
  }

  return { plan, todayDay, progressPct, perfectDays, toggle, resetToDefault, regenerate, clearChecks }
}
