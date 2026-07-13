// Per-user health doc (profile + lean daily log). Cloud sync plumbing lives in
// useCloudSyncStore; this file only owns the health-specific shape, migration
// and daily-rollover rules. Module-scope singleton via the shared registry.

import { computed } from 'vue'
import { healthStateApi } from '@/api'
import type { HealthProfile, HealthLog } from '@/data/health'
import { initialLog, computeMetrics, summarizeDay } from '@/utils/healthPlan'
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
  if (!Array.isArray(l.entries)) l.entries = []
  if (l.review === undefined) l.review = null
  if (!Array.isArray(l.history)) l.history = []
  return { profile: raw.profile, log: raw.log }
}

/** Freeze the day we're leaving into history (upsert by date) so the calendar keeps it. */
function archiveDay(d: Persisted): void {
  if (!d.log.entries?.length) return
  const s = summarizeDay(d.log.date, d.log.entries, d.log.review)
  const hist = d.log.history ?? (d.log.history = [])
  const i = hist.findIndex((x) => x.date === s.date)
  if (i >= 0) hist[i] = s
  else hist.push(s)
  // Cap to ~13 months so the synced doc never grows unbounded.
  if (hist.length > 400) d.log.history = hist.slice(-400)
}

/**
 * Roll the daily log over to today: the AI food log and water are per-day and
 * reset at midnight (yesterday's log is frozen into history first). Weight,
 * weight history, history and goals are cumulative.
 */
function rollDaily(d: Persisted): boolean {
  const today = todayKey()
  if (d.log.date === today) return false
  archiveDay(d)
  d.log.date = today
  d.log.water = 0
  d.log.entries = []
  d.log.review = null
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
