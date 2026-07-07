// Shared plumbing behind the per-user "cloud-synced singleton" composables
// (useHealthStore, usePlan, useEnglishStore, ...): localStorage is the
// immediate, offline-safe cache; a small per-module backend endpoint is a
// background sync layer so the data follows the user across devices. Backend
// failures degrade silently — the app keeps working on localStorage alone.
//
// Each concrete store still owns its own shape, defaults, migration and
// domain actions — this only centralizes the load/persist/pull-once
// bookkeeping that was previously copy-pasted across every store.

import { reactive, computed, watch, type ComputedRef } from 'vue'
import { useAuthStore } from '@/stores/auth'

export interface CloudSyncApi<T> {
  get<R = T>(): Promise<R | null>
  put(body: T): Promise<unknown>
}

export interface CloudSyncOptions<T> {
  /** localStorage key prefix; the final key is `${namespace}:${uid}`. */
  namespace: string
  api: CloudSyncApi<T>
  /** Value to use when there is no cached/remote doc yet (health uses `null` until onboarding). */
  createDefault: () => T | null
  /** Validate + migrate a raw doc (from localStorage OR the server). Return null to treat it as absent. */
  normalize: (raw: T | null | undefined) => T | null
  /** Run on every (re)load, e.g. day-rollover. Return true if it mutated `data` so it gets persisted. */
  onLoad?: (data: T) => boolean | void
  pushDebounceMs?: number
}

export interface CloudSyncStore<T> {
  data: ComputedRef<T | null>
  uid: ComputedRef<string | null>
  /** Mutate the current doc in place, then persist (no-op if there's no doc yet). */
  update: (mutator: (d: T) => void) => void
  /** Replace the whole doc and persist (for "regenerate" / "reset to default" flows). */
  replace: (value: T) => void
  /** Persist whatever `data` currently holds (used after `clear()` + a manual assignment). */
  persist: () => void
  /** Wipe the local cache back to `createDefault()`. Does not push — the next edit will. */
  clear: () => void
}

// Keyed by namespace so the underlying reactive box is a true module-scope
// singleton even though `useCloudSyncStore()` itself runs once per caller
// (mirrors how each original store kept one `state` object at module scope).
const registry = new Map<string, { state: { uid: string | null; data: unknown }; pulledForUid: string | null; pushTimer: ReturnType<typeof setTimeout> | undefined }>()

export function useCloudSyncStore<T>(opts: CloudSyncOptions<T>): CloudSyncStore<T> {
  let box = registry.get(opts.namespace) as
    | { state: { uid: string | null; data: T | null }; pulledForUid: string | null; pushTimer: ReturnType<typeof setTimeout> | undefined }
    | undefined
  if (!box) {
    box = { state: reactive({ uid: null, data: null }) as { uid: string | null; data: T | null }, pulledForUid: null, pushTimer: undefined }
    registry.set(opts.namespace, box)
  }
  const state = box.state

  const storageKey = (uid: string) => `${opts.namespace}:${uid}`

  function load(uid: string) {
    state.uid = uid
    try {
      const raw = localStorage.getItem(storageKey(uid))
      state.data = raw ? opts.normalize(JSON.parse(raw) as T) ?? opts.createDefault() : opts.createDefault()
    } catch {
      state.data = opts.createDefault()
    }
  }

  function persist() {
    if (!state.uid || state.data == null) return
    localStorage.setItem(storageKey(state.uid), JSON.stringify(state.data))
    schedulePush()
  }

  /** Debounced push of the full doc to the backend. */
  function schedulePush() {
    if (!state.uid) return
    clearTimeout(box!.pushTimer)
    box!.pushTimer = setTimeout(() => {
      if (state.uid && state.data != null) opts.api.put(state.data).catch(() => undefined)
    }, opts.pushDebounceMs ?? 1500)
  }

  /**
   * Pull the cloud doc once per uid. If the cloud has one, it wins (replaces
   * the local cache); if not but we have a local doc, push it up to seed the
   * account. Failures are swallowed so the app keeps working on localStorage.
   */
  async function pullOnce(targetUid: string) {
    if (box!.pulledForUid === targetUid) return
    box!.pulledForUid = targetUid
    try {
      const remote = await opts.api.get()
      if (state.uid !== targetUid) return
      const norm = opts.normalize(remote as T | null)
      if (norm != null) {
        opts.onLoad?.(norm)
        state.data = norm
        localStorage.setItem(storageKey(targetUid), JSON.stringify(norm))
      } else if (state.data != null) {
        opts.api.put(state.data).catch(() => undefined)
      }
    } catch {
      box!.pulledForUid = null // allow a retry on the next interaction
    }
  }

  const auth = useAuthStore()
  const uid = computed(() => auth.firebaseUser?.uid ?? null)

  function ensureLoaded() {
    if (uid.value && state.uid !== uid.value) load(uid.value)
    if (state.data != null && opts.onLoad?.(state.data)) persist()
    if (uid.value) void pullOnce(uid.value)
  }
  ensureLoaded()
  watch(uid, ensureLoaded)

  const data = computed(() => state.data)

  function update(mutator: (d: T) => void) {
    if (state.data == null) return
    mutator(state.data)
    persist()
  }

  function replace(value: T) {
    state.data = value
    persist()
  }

  function clear() {
    if (state.uid) localStorage.removeItem(storageKey(state.uid))
    state.data = opts.createDefault()
    box!.pulledForUid = null
  }

  return { data, uid, update, replace, persist, clear }
}
