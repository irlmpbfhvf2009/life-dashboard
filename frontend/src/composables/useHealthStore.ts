// Per-user health doc (profile + lean daily log). Cloud sync plumbing lives in
// useCloudSyncStore; this file only owns the health-specific shape, migration
// and daily-rollover rules. Module-scope singleton via the shared registry.

import { computed } from 'vue'
import { healthStateApi } from '@/api'
import type { HealthProfile, HealthLog } from '@/data/health'
import { initialLog, computeMetrics } from '@/utils/healthPlan'
import { useCloudSyncStore } from './useCloudSyncStore'

interface Persisted {
  profile: HealthProfile
  log: HealthLog
}

const todayKey = () =>
  new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10)

/** Migrate/backfill a loaded doc from older (bloated) schemas to the lean shape. */
function normalize(raw: Persisted | null | undefined): Persisted | null {
  if (!raw?.profile || !raw?.log) return null
  const l = raw.log as HealthLog & Record<string, unknown>
  if (!l.weightHistory) l.weightHistory = [{ date: l.date, kg: l.weightKg }]
  if (l.waterGoal == null) l.waterGoal = computeMetrics(raw.profile).recommendWaterMl
  // Migrate old cup-based water (goal ≤ 12) to millilitres.
  if (l.waterGoal <= 12) {
    l.water = (l.water || 0) * 250
    l.waterGoal = 2000
  }
  if (raw.profile.accessory == null) raw.profile.accessory = 'none'
  return { profile: raw.profile, log: raw.log }
}

/**
 * Roll the daily log over to today: water is per-day and resets at midnight.
 * Weight, weight history and goals are cumulative and carried forward.
 */
function rollDaily(d: Persisted): boolean {
  const today = todayKey()
  if (d.log.date === today) return false
  d.log.date = today
  d.log.water = 0
  return true
}

export function useHealthStore() {
  const cloud = useCloudSyncStore<Persisted>({
    namespace: 'health',
    api: healthStateApi,
    createDefault: () => null,
    normalize,
    onLoad: rollDaily,
  })

  const isOnboarded = computed(() => !!cloud.data.value?.profile)
  const profile = computed<HealthProfile | null>(() => cloud.data.value?.profile ?? null)
  const log = computed<HealthLog | null>(() => cloud.data.value?.log ?? null)

  /** Complete onboarding: seed a fresh zero-state daily log. */
  function onboard(p: HealthProfile) {
    cloud.replace({ profile: p, log: initialLog(p) })
  }

  /** Edit the profile later: recompute the water goal, keep the log. */
  function updateProfile(p: HealthProfile) {
    if (!cloud.data.value) { onboard(p); return }
    cloud.update((d) => {
      d.profile = p
      d.log.waterGoal = computeMetrics(p).recommendWaterMl
    })
  }

  /** Mutate the persisted data in place, then save. */
  function update(mutator: (d: Persisted) => void) {
    cloud.update(mutator)
  }

  /** Wipe this user's local health cache (back to onboarding). Cloud is overwritten on next edit. */
  function reset() {
    cloud.clear()
  }

  return { isOnboarded, profile, log, onboard, updateProfile, update, reset }
}
