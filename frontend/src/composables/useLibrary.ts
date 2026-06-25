// Per-user library state: bookmarks + reading progress. localStorage is the
// immediate cache (synchronous, offline-safe); the backend (/api/library/state)
// is a background sync layer so saved books and where-you-left-off follow the
// user across devices. Cloud-first on pull, silent degrade on failure. Mirrors
// the travel/English stores.

import { computed, reactive, watch } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { libraryStateApi } from '@/api'

export interface BookRef {
  source: string // 'gutenberg' | 'wikisource'
  id: string
  title: string
  author?: string
}

export interface Bookmark extends BookRef {
  addedAt: string
}

export interface Progress extends BookRef {
  pct: number // 0..1
  updatedAt: string
}

interface Persisted {
  bookmarks: Bookmark[]
  progress: Record<string, Progress> // key `${source}:${id}`
}

const keyOf = (source: string, id: string) => `${source}:${id}`
const storageKey = (uid: string) => `library:${uid}`

function freshState(): Persisted {
  return { bookmarks: [], progress: {} }
}

function normalize(raw: unknown): Persisted {
  const base = freshState()
  if (!raw || typeof raw !== 'object') return base
  const r = raw as Record<string, unknown>
  const bookmarks = Array.isArray(r.bookmarks) ? (r.bookmarks as Bookmark[]) : []
  const progress = r.progress && typeof r.progress === 'object' ? (r.progress as Record<string, Progress>) : {}
  return { bookmarks, progress }
}

const state = reactive<{ uid: string | null; data: Persisted | null }>({ uid: null, data: null })
let pulledForUid: string | null = null
let pushTimer: ReturnType<typeof setTimeout> | undefined

function load(uid: string) {
  state.uid = uid
  try {
    const raw = localStorage.getItem(storageKey(uid))
    state.data = raw ? normalize(JSON.parse(raw)) : freshState()
  } catch {
    state.data = freshState()
  }
}

function persist() {
  if (!state.uid || !state.data) return
  localStorage.setItem(storageKey(state.uid), JSON.stringify(state.data))
  clearTimeout(pushTimer)
  pushTimer = setTimeout(() => {
    if (state.uid && state.data) libraryStateApi.put(state.data).catch(() => undefined)
  }, 1200)
}

async function pullOnce(targetUid: string) {
  if (pulledForUid === targetUid) return
  pulledForUid = targetUid
  try {
    const remote = await libraryStateApi.get<Persisted>()
    if (state.uid !== targetUid) return
    if (remote && typeof remote === 'object') {
      state.data = normalize(remote)
      localStorage.setItem(storageKey(targetUid), JSON.stringify(state.data))
    } else if (state.data) {
      libraryStateApi.put(state.data).catch(() => undefined)
    }
  } catch {
    pulledForUid = null
  }
}

export function useLibrary() {
  const auth = useAuthStore()
  const uid = computed(() => auth.firebaseUser?.uid ?? null)
  function ensureLoaded() {
    if (uid.value && state.uid !== uid.value) load(uid.value)
    if (uid.value) void pullOnce(uid.value)
  }
  ensureLoaded()
  watch(uid, ensureLoaded)

  const bookmarks = computed<Bookmark[]>(() =>
    [...(state.data?.bookmarks ?? [])].sort((a, b) => (a.addedAt < b.addedAt ? 1 : -1)),
  )

  /** In-progress books, most-recent first (excludes essentially-finished ones). */
  const recentlyRead = computed<Progress[]>(() =>
    Object.values(state.data?.progress ?? {})
      .filter((p) => p.pct > 0.01 && p.pct < 0.97)
      .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1)),
  )

  function isBookmarked(source: string, id: string) {
    return (state.data?.bookmarks ?? []).some((b) => b.source === source && b.id === id)
  }

  function toggleBookmark(book: BookRef) {
    if (!state.data) return
    const i = state.data.bookmarks.findIndex((b) => b.source === book.source && b.id === book.id)
    if (i >= 0) state.data.bookmarks.splice(i, 1)
    else state.data.bookmarks.push({ ...book, addedAt: new Date().toISOString() })
    persist()
  }

  function getProgress(source: string, id: string): number {
    return state.data?.progress[keyOf(source, id)]?.pct ?? 0
  }

  function saveProgress(book: BookRef, pct: number) {
    if (!state.data) return
    const clamped = Math.max(0, Math.min(1, pct))
    state.data.progress[keyOf(book.source, book.id)] = { ...book, pct: clamped, updatedAt: new Date().toISOString() }
    persist()
  }

  return { bookmarks, recentlyRead, isBookmarked, toggleBookmark, getProgress, saveProgress }
}
