// Site-wide virtual pet. localStorage is the immediate, offline-safe cache; the
// backend (/api/pet/state) is a background sync layer so the pet follows the
// user across devices (cloud wins on first load, failures degrade silently).
//
// Module-scope singleton so the floating PetWidget and the /pet settings page
// share one reactive state.

import { computed, reactive, watch } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { petStateApi } from '@/api'
import { todayISO } from '@/utils/format'
import { animalDef, type AnimalKey } from '@/data/animals'
import type { AccessoryKey } from '@/data/accessories'
import type { OtterMood } from '@/data/health'

interface PetData {
  enabled: boolean
  animal: AnimalKey
  name: string
  accessory: AccessoryKey
  level: number
  xp: number
  xpToNext: number
  lastActiveDate: string | null
}

function freshState(): PetData {
  return {
    enabled: false, // opt-in — the user turns the pet on from the sidebar / settings
    animal: 'otter',
    name: animalDef('otter').defaultName,
    accessory: 'none',
    level: 1,
    xp: 0,
    xpToNext: 100,
    lastActiveDate: null,
  }
}

const state = reactive<{ uid: string | null; data: PetData | null }>({ uid: null, data: null })
let pulledForUid: string | null = null
let petCooldown = 0

function storageKey(uid: string) {
  return `pet-state:${uid}`
}

function load(uid: string) {
  state.uid = uid
  try {
    const raw = localStorage.getItem(storageKey(uid))
    state.data = raw ? { ...freshState(), ...(JSON.parse(raw) as PetData) } : freshState()
  } catch {
    state.data = freshState()
  }
}

function persist() {
  if (!state.uid || !state.data) return
  localStorage.setItem(storageKey(state.uid), JSON.stringify(state.data))
  petStateApi.put(state.data).catch(() => undefined)
}

export function usePet() {
  const auth = useAuthStore()
  const uid = computed(() => auth.firebaseUser?.uid ?? null)

  function ensureLoaded() {
    if (uid.value && state.uid !== uid.value) load(uid.value)
    if (uid.value) void pullOnce(uid.value)
  }

  async function pullOnce(targetUid: string) {
    if (pulledForUid === targetUid) return
    pulledForUid = targetUid
    try {
      const remote = await petStateApi.get<PetData>()
      if (state.uid !== targetUid) return
      if (remote && typeof remote === 'object') {
        state.data = { ...freshState(), ...remote }
        localStorage.setItem(storageKey(targetUid), JSON.stringify(state.data))
      } else if (state.data) {
        petStateApi.put(state.data).catch(() => undefined)
      }
    } catch {
      pulledForUid = null // allow a retry on the next interaction
    }
  }

  ensureLoaded()
  watch(uid, ensureLoaded)

  const data = computed<PetData>(() => state.data ?? freshState())
  const enabled = computed(() => data.value.enabled)
  const xpPercent = computed(() =>
    data.value.xpToNext > 0 ? Math.min(100, Math.round((data.value.xp / data.value.xpToNext) * 100)) : 0,
  )

  // Mood reflects recent engagement: cheerful if active today, sleepy if it's
  // been a couple of quiet days, otherwise content.
  const mood = computed<OtterMood>(() => {
    const last = data.value.lastActiveDate
    if (last === todayISO()) return 'great'
    if (!last) return 'good'
    const days = Math.floor((Date.now() - new Date(`${last}T00:00:00`).getTime()) / 86_400_000)
    return days >= 2 ? 'tired' : 'good'
  })

  function update(fn: (d: PetData) => void) {
    if (!state.data) return
    fn(state.data)
    persist()
  }

  function awardXp(amount: number) {
    update((d) => {
      d.xp += amount
      if (d.xp < 0) d.xp = 0
      while (d.xp >= d.xpToNext) {
        d.xp -= d.xpToNext
        d.level += 1
        d.xpToNext += 20
      }
    })
  }

  /** Once-per-day engagement bonus, called when the pet is shown. */
  function checkInToday() {
    if (!state.data || !state.data.enabled) return
    if (state.data.lastActiveDate === todayISO()) return
    update((d) => { d.lastActiveDate = todayISO() })
    awardXp(15)
  }

  /** Petting reward (click), rate-limited so it can't be farmed. */
  function pet() {
    const now = Date.now()
    if (now < petCooldown) return false
    petCooldown = now + 20_000
    awardXp(3)
    return true
  }

  return {
    data, enabled, mood, xpPercent,
    setEnabled: (v: boolean) => update((d) => { d.enabled = v }),
    toggle: () => update((d) => { d.enabled = !d.enabled }),
    setAnimal: (a: AnimalKey) => update((d) => { d.animal = a }),
    setName: (n: string) => update((d) => { d.name = n.trim() || animalDef(d.animal).defaultName }),
    setAccessory: (a: AccessoryKey) => update((d) => { d.accessory = a }),
    awardXp, checkInToday, pet,
  }
}
