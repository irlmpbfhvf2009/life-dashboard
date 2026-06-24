// Per-user English-Coach state, persisted to localStorage. This is the ONLY
// layer that touches storage; swapping to the Spring Boot backend later means
// rewriting just this file + api/english.ts — the views stay the same.

import { computed, reactive, watch } from 'vue'
import { useAuthStore } from '@/stores/auth'
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
  }
}

const storageKey = (uid: string) => `english:${uid}`

const state = reactive<{ uid: string | null; data: Persisted | null }>({ uid: null, data: null })

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
  if (state.uid && state.data) localStorage.setItem(storageKey(state.uid), JSON.stringify(state.data))
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
  }
  function completeScenario(id: string) {
    update((d) => {
      if (!d.completedScenarioIds.includes(id)) d.completedScenarioIds.push(id)
      d.sessionsThisWeek += 1
    })
    bumpMission('m-conv')
  }

  function reset() {
    if (state.uid) localStorage.removeItem(storageKey(state.uid))
    state.data = freshState()
    persist()
  }

  return {
    data, isOnboarded, level, mission, mistakes, reviews, dueReviews,
    update, touchStreak, setLevel, bumpMission, addMistake, addStudyMinutes,
    recordSpeaking, masterVocab, completeScenario, reset,
  }
}
