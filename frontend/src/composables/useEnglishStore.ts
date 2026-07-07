// Per-user English-Coach state. Cloud sync plumbing lives in useCloudSyncStore;
// this file only owns the state shape, defaults and the coach's domain actions
// (streak, missions, mistakes, spaced-repetition review).

import { computed } from 'vue'
import { englishStateApi } from '@/api'
import { todayISO } from '@/utils/format'
import type {
  DailyMission,
  EnglishMistake,
  MistakeCategory,
  ReviewItem,
  UserEnglishLevel,
} from '@/types/english'
import { useCloudSyncStore } from './useCloudSyncStore'

interface Persisted {
  level: UserEnglishLevel
  streakDays: number
  lastActiveDate: string | null
  studyMinutes: number
  speakingMinutes: number
  speechAttempts: number
  masteredVocabIds: string[]
  masteredPhraseIds: string[]
  completedScenarioIds: string[]
  sessionsThisWeek: number
  mistakes: EnglishMistake[]
  reviews: ReviewItem[]
  mission: DailyMission | null
  reviewedTodayCount: number
  reviewedTodayDate: string | null
}

function freshState(): Persisted {
  return {
    level: { level: 'BEGINNER', assessedAt: null },
    streakDays: 0,
    lastActiveDate: null,
    studyMinutes: 0,
    speakingMinutes: 0,
    speechAttempts: 0,
    masteredVocabIds: [],
    masteredPhraseIds: [],
    completedScenarioIds: [],
    sessionsThisWeek: 0,
    mistakes: [],
    reviews: [],
    mission: null,
    reviewedTodayCount: 0,
    reviewedTodayDate: null,
  }
}

/** Merge a raw (possibly partial/legacy) doc over the current defaults. */
function normalize(raw: Persisted | null | undefined): Persisted | null {
  if (!raw || typeof raw !== 'object') return null
  return { ...freshState(), ...raw }
}

const REVIEW_STEPS: ReviewItem['status'][] = ['NEW', 'LEARNING', 'REVIEWING', 'MASTERED']
const REVIEW_INTERVALS = [1, 3, 7, 21] // days per step

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00`)
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

function buildDailyMission(date: string): DailyMission {
  const tasks = [
    { id: 'm-vocab', kind: 'vocab' as const, label: '學 5 個情境單字', target: 5, progress: 0, done: false, deepLink: '/ai/english/vocabulary' },
    { id: 'm-phrase', kind: 'phrase' as const, label: '練 2 個句型', target: 2, progress: 0, done: false, deepLink: '/ai/english/phrases' },
    { id: 'm-conv', kind: 'conversation' as const, label: '完成 1 段 AI 對話', target: 1, progress: 0, done: false, deepLink: '/ai/english/scenarios' },
    { id: 'm-correct', kind: 'correction' as const, label: '修正 3 個句子', target: 3, progress: 0, done: false, deepLink: '/ai/english/coach' },
    { id: 'm-speak', kind: 'speaking' as const, label: '完成 5 分鐘口說練習', target: 5, progress: 0, done: false, deepLink: '/ai/english/speaking' },
  ]
  return { date, tasks, completedCount: 0, totalCount: tasks.length }
}

/** Refresh the daily mission when the date changes. */
function rollDailyMission(d: Persisted): boolean {
  const today = todayISO()
  if (!d.mission || d.mission.date !== today) {
    d.mission = buildDailyMission(today)
    return true
  }
  return false
}

export function useEnglishStore() {
  const cloud = useCloudSyncStore<Persisted>({
    namespace: 'english',
    api: englishStateApi,
    createDefault: freshState,
    normalize,
    onLoad: rollDailyMission,
  })

  const data = computed<Persisted | null>(() => cloud.data.value)
  const isOnboarded = computed(() => !!cloud.data.value?.level.assessedAt)
  const level = computed(() => cloud.data.value?.level ?? freshState().level)
  const mission = computed(() => cloud.data.value?.mission ?? null)
  const mistakes = computed(() => cloud.data.value?.mistakes ?? [])
  const reviews = computed(() => cloud.data.value?.reviews ?? [])
  const dueReviews = computed(() => reviews.value.filter((r) => r.dueDate <= todayISO() && r.status !== 'MASTERED'))

  function update(mutator: (d: Persisted) => void) {
    cloud.update(mutator)
  }

  /** Mark today active and advance the streak (idempotent per day). */
  function touchStreak() {
    update((d) => {
      const today = todayISO()
      if (d.lastActiveDate === today) return
      const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10)
      d.streakDays = d.lastActiveDate === yesterday ? d.streakDays + 1 : 1
      d.lastActiveDate = today
    })
  }

  function setLevel(l: UserEnglishLevel) {
    update((d) => { d.level = l })
  }

  function bumpMission(taskId: string, by = 1) {
    update((d) => {
      if (!d.mission) return
      const task = d.mission.tasks.find((t) => t.id === taskId)
      if (!task || task.done) return
      task.progress = Math.min(task.target, task.progress + by)
      task.done = task.progress >= task.target
      d.mission.completedCount = d.mission.tasks.filter((t) => t.done).length
    })
    touchStreak()
  }

  /** Record a mistake (merging duplicates by original text) + queue for review. */
  function addMistake(m: { category: MistakeCategory; original: string; corrected: string; note: string }) {
    update((d) => {
      const today = todayISO()
      const existing = d.mistakes.find((x) => x.original.toLowerCase() === m.original.toLowerCase())
      if (existing) {
        existing.frequency += 1
        existing.lastSeen = today
        existing.corrected = m.corrected
      } else {
        const id = `mk-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
        d.mistakes.unshift({ id, ...m, frequency: 1, lastSeen: today, mastery: 'NEW' })
        d.reviews.unshift({
          id: `rv-${id}`, refType: 'mistake', refId: id, title: m.original,
          status: 'NEW', dueDate: today, interval: 1, ease: 2.3,
        })
      }
    })
  }

  function addStudyMinutes(min: number) {
    update((d) => { d.studyMinutes += min })
    touchStreak()
  }
  function recordSpeaking(minutes: number) {
    update((d) => { d.speakingMinutes += minutes; d.speechAttempts += 1 })
    touchStreak()
  }
  function masterVocab(id: string) {
    update((d) => { if (!d.masteredVocabIds.includes(id)) d.masteredVocabIds.push(id) })
    bumpMission('m-vocab')
  }
  function masterPhrase(id: string) {
    update((d) => { if (!d.masteredPhraseIds.includes(id)) d.masteredPhraseIds.push(id) })
    bumpMission('m-phrase')
  }

  /** Queue a vocab/phrase (or other ref) for review without logging a mistake. */
  function queueReview(refType: ReviewItem['refType'], refId: string, title: string) {
    update((d) => {
      if (d.reviews.some((r) => r.refType === refType && r.refId === refId)) return
      d.reviews.unshift({
        id: `rv-${refType}-${refId}-${Date.now()}`, refType, refId, title,
        status: 'NEW', dueDate: todayISO(), interval: 1, ease: 2.3,
      })
    })
  }
  function completeScenario(id: string) {
    update((d) => {
      if (!d.completedScenarioIds.includes(id)) d.completedScenarioIds.push(id)
      d.sessionsThisWeek += 1
    })
    bumpMission('m-conv')
  }

  /**
   * Simplified spaced-repetition (SM-2 inspired): remembered → advance a step and
   * push the due date out; forgot → drop back to LEARNING and review again tomorrow.
   */
  function reviewComplete(id: string, remembered: boolean) {
    update((d) => {
      const r = d.reviews.find((x) => x.id === id)
      if (!r) return
      const today = todayISO()
      let i = REVIEW_STEPS.indexOf(r.status)
      if (remembered) {
        i = Math.min(3, i + 1)
        r.ease = Math.min(3.0, r.ease + 0.1)
      } else {
        i = 1
        r.ease = Math.max(1.3, r.ease - 0.2)
      }
      r.status = REVIEW_STEPS[i]
      r.interval = REVIEW_INTERVALS[i]
      r.dueDate = addDays(today, r.interval)
      // Reflect mastery onto the linked mistake.
      if (r.refType === 'mistake') {
        const m = d.mistakes.find((x) => x.id === r.refId)
        if (m) m.mastery = r.status
      }
      // Track today's completed reviews.
      if (d.reviewedTodayDate !== today) {
        d.reviewedTodayDate = today
        d.reviewedTodayCount = 0
      }
      d.reviewedTodayCount += 1
    })
    bumpMission('m-review')
  }

  const reviewedToday = computed(() =>
    cloud.data.value?.reviewedTodayDate === todayISO() ? cloud.data.value.reviewedTodayCount : 0,
  )

  function reset() {
    cloud.replace(freshState())
  }

  return {
    data, isOnboarded, level, mission, mistakes, reviews, dueReviews, reviewedToday,
    update, touchStreak, setLevel, bumpMission, addMistake, addStudyMinutes,
    recordSpeaking, masterVocab, masterPhrase, queueReview, reviewComplete, completeScenario, reset,
  }
}
