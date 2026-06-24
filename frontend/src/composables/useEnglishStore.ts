// Per-user English-Coach state. localStorage is the immediate cache (synchronous,
// offline-safe); the backend (/api/english/state) is a background sync layer so
// the state follows the user across devices. Backend failures degrade silently —
// the app keeps working on localStorage alone.

import { computed, reactive, watch } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { englishStateApi } from '@/api'
import { todayISO } from '@/utils/format'
import type {
  DailyMission,
  EnglishMistake,
  MistakeCategory,
  ReviewItem,
  UserEnglishLevel,
} from '@/types/english'

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

const REVIEW_STEPS: ReviewItem['status'][] = ['NEW', 'LEARNING', 'REVIEWING', 'MASTERED']
const REVIEW_INTERVALS = [1, 3, 7, 21] // days per step

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00`)
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

const storageKey = (uid: string) => `english:${uid}`

const state = reactive<{ uid: string | null; data: Persisted | null }>({ uid: null, data: null })

// Background-sync bookkeeping.
let pulledForUid: string | null = null
let pushTimer: ReturnType<typeof setTimeout> | undefined

function load(uid: string) {
  state.uid = uid
  try {
    const raw = localStorage.getItem(storageKey(uid))
    state.data = raw ? { ...freshState(), ...(JSON.parse(raw) as Persisted) } : freshState()
  } catch {
    state.data = freshState()
  }
}

function persist() {
  if (!state.uid || !state.data) return
  localStorage.setItem(storageKey(state.uid), JSON.stringify(state.data))
  schedulePush()
}

/** Debounced push of the full state document to the backend. */
function schedulePush() {
  if (!state.uid) return
  clearTimeout(pushTimer)
  pushTimer = setTimeout(() => {
    if (state.uid && state.data) englishStateApi.put(state.data).catch(() => undefined)
  }, 1500)
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

export function useEnglishStore() {
  const auth = useAuthStore()
  const uid = computed(() => auth.firebaseUser?.uid ?? null)

  function ensureLoaded() {
    if (uid.value && state.uid !== uid.value) load(uid.value)
    if (state.data) rollDailyAndStreak()
    if (uid.value) void pullOnce(uid.value)
  }

  /**
   * Pull the cloud state once per uid. If the cloud has state, it wins (replaces
   * the local cache); if not, push the current local state up. Failures are
   * swallowed so the app keeps running on localStorage.
   */
  async function pullOnce(targetUid: string) {
    if (pulledForUid === targetUid) return
    pulledForUid = targetUid
    try {
      const remote = await englishStateApi.get<Persisted>()
      if (state.uid !== targetUid) return
      if (remote && typeof remote === 'object') {
        state.data = { ...freshState(), ...remote }
        localStorage.setItem(storageKey(targetUid), JSON.stringify(state.data))
        rollDailyAndStreak()
      } else if (state.data) {
        englishStateApi.put(state.data).catch(() => undefined)
      }
    } catch {
      pulledForUid = null // allow a retry on the next interaction
    }
  }

  /** Refresh the daily mission and streak when the date changes. */
  function rollDailyAndStreak() {
    const d = state.data!
    const today = todayISO()
    if (!d.mission || d.mission.date !== today) {
      d.mission = buildDailyMission(today)
      persist()
    }
  }

  ensureLoaded()
  watch(uid, ensureLoaded)

  const data = computed<Persisted | null>(() => state.data)
  const isOnboarded = computed(() => !!state.data?.level.assessedAt)
  const level = computed(() => state.data?.level ?? freshState().level)
  const mission = computed(() => state.data?.mission ?? null)
  const mistakes = computed(() => state.data?.mistakes ?? [])
  const reviews = computed(() => state.data?.reviews ?? [])
  const dueReviews = computed(() => reviews.value.filter((r) => r.dueDate <= todayISO() && r.status !== 'MASTERED'))

  function update(mutator: (d: Persisted) => void) {
    if (!state.data) return
    mutator(state.data)
    persist()
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
    state.data?.reviewedTodayDate === todayISO() ? state.data.reviewedTodayCount : 0,
  )

  function reset() {
    if (state.uid) localStorage.removeItem(storageKey(state.uid))
    state.data = freshState()
    persist()
  }

  return {
    data, isOnboarded, level, mission, mistakes, reviews, dueReviews, reviewedToday,
    update, touchStreak, setLevel, bumpMission, addMistake, addStudyMinutes,
    recordSpeaking, masterVocab, masterPhrase, queueReview, reviewComplete, completeScenario, reset,
  }
}
