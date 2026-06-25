// Per-user, multi-country trip wallet. localStorage is the immediate cache
// (synchronous, offline-safe); the backend (/api/travel/state) is a background
// sync layer so the trip budget + selected destination follow the user across
// devices. Backend failures degrade silently. Mirrors the English-Coach store.
//
// Each expense is recorded in the active destination's currency; switching
// destination shows that currency's expenses, with a per-currency editable rate.

import { computed, reactive, ref, watch } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { travelStateApi, fxApi } from '@/api'
import { destinations, destinationById, type Destination } from '@/data/destinations'

// Session-only "rate last updated" by currency code (display hint, not persisted).
const rateAsOf = reactive<Record<string, string>>({})

export interface TripExpense {
  id: string
  date: string // ISO yyyy-mm-dd
  category: string
  amount: number // in `currency`
  currency: string // currency code, e.g. THB / JPY / KRW / VND
  note: string
}

export const TRIP_CATEGORIES = ['餐飲', '交通', '購物', '住宿', '娛樂', '其他'] as const
export type TripCategory = (typeof TRIP_CATEGORIES)[number]

export interface PackingItem {
  id: string
  label: string
  done: boolean
}

export interface ItineraryItem {
  id: string
  day: number // 1-based day index
  time: string // free text, e.g. "09:00"
  place: string
  note: string
  /** Geocoded coordinates (filled lazily by the map). */
  lat?: number
  lon?: number
}

/** Trip logistics for the offline emergency card (per destination). */
export interface TripInfo {
  hotelName: string
  hotelAddress: string
  bookingRef: string
  insurer: string
  insurancePhone: string
  embassy: string
  bloodType: string
  notes: string
}

export function emptyTripInfo(): TripInfo {
  return {
    hotelName: '', hotelAddress: '', bookingRef: '', insurer: '',
    insurancePhone: '', embassy: '', bloodType: '', notes: '',
  }
}

/** One travel-journal entry (per destination). Photos live in Firebase Storage; we only keep URLs. */
export interface JournalEntry {
  id: string
  date: string // ISO yyyy-mm-dd
  text: string
  photoUrls: string[]
}

interface Persisted {
  items: TripExpense[]
  /** TWD per 1 unit, keyed by currency code. */
  rates: Record<string, number>
  departDate: string
  destinationId: string
  /** Packing checklist, keyed by destinationId. */
  packing: Record<string, PackingItem[]>
  /** Itinerary items, keyed by destinationId. */
  itinerary: Record<string, ItineraryItem[]>
  /** Trip budget in TWD, keyed by destinationId. */
  budgets: Record<string, number>
  /** Emergency-card trip info, keyed by destinationId. */
  trip: Record<string, TripInfo>
  /** Travel journal entries, keyed by destinationId. */
  journal: Record<string, JournalEntry[]>
}

const storageKey = (uid: string) => `travel:${uid}`

function freshState(): Persisted {
  return {
    items: [], rates: {}, departDate: '', destinationId: destinations[0].id,
    packing: {}, itinerary: {}, budgets: {}, trip: {}, journal: {},
  }
}

/** Upgrade any previously-stored shape (incl. the THB-only version) to Persisted. */
function normalize(raw: unknown): Persisted {
  const base = freshState()
  if (!raw || typeof raw !== 'object') return base
  const r = raw as Record<string, unknown>

  const items: TripExpense[] = Array.isArray(r.items)
    ? (r.items as Record<string, unknown>[]).map((e) => ({
        id: String(e.id ?? `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`),
        date: typeof e.date === 'string' ? e.date : '',
        category: typeof e.category === 'string' ? e.category : '其他',
        amount:
          typeof e.amount === 'number'
            ? e.amount
            : typeof e.amountThb === 'number'
              ? (e.amountThb as number)
              : 0,
        currency: typeof e.currency === 'string' ? e.currency : 'THB',
        note: typeof e.note === 'string' ? e.note : '',
      }))
    : []

  const rates: Record<string, number> =
    r.rates && typeof r.rates === 'object' ? { ...(r.rates as Record<string, number>) } : {}
  // Legacy single-rate field.
  if (typeof r.thbToTwd === 'number' && rates.THB == null) rates.THB = r.thbToTwd as number

  const packing = (r.packing && typeof r.packing === 'object' ? r.packing : {}) as Record<string, PackingItem[]>
  const itinerary = (r.itinerary && typeof r.itinerary === 'object' ? r.itinerary : {}) as Record<string, ItineraryItem[]>
  const budgets = (r.budgets && typeof r.budgets === 'object' ? r.budgets : {}) as Record<string, number>
  const trip = (r.trip && typeof r.trip === 'object' ? r.trip : {}) as Record<string, TripInfo>
  const journal = (r.journal && typeof r.journal === 'object' ? r.journal : {}) as Record<string, JournalEntry[]>

  return {
    items,
    rates,
    departDate: typeof r.departDate === 'string' ? r.departDate : '',
    destinationId: typeof r.destinationId === 'string' ? r.destinationId : base.destinationId,
    packing,
    itinerary,
    budgets,
    trip,
    journal,
  }
}

const uid4 = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`

const state = reactive<{ uid: string | null; data: Persisted | null }>({ uid: null, data: null })

let pulledForUid: string | null = null
let pushTimer: ReturnType<typeof setTimeout> | undefined

/** Import data saved under the original device-local keys (pre per-user sync). */
function migrateLegacy(): Persisted | null {
  try {
    const items = localStorage.getItem('travel.tripExpenses')
    const rate = localStorage.getItem('travel.thbToTwd')
    const depart = localStorage.getItem('travel.departDate')
    if (!items && !rate && !depart) return null
    return normalize({
      items: items ? JSON.parse(items) : [],
      thbToTwd: rate ? JSON.parse(rate) : undefined,
      departDate: depart ?? '',
    })
  } catch {
    return null
  }
}

function load(uid: string) {
  state.uid = uid
  try {
    const raw = localStorage.getItem(storageKey(uid))
    state.data = raw ? normalize(JSON.parse(raw)) : (migrateLegacy() ?? freshState())
  } catch {
    state.data = freshState()
  }
}

function persist() {
  if (!state.uid || !state.data) return
  localStorage.setItem(storageKey(state.uid), JSON.stringify(state.data))
  schedulePush()
}

function schedulePush() {
  if (!state.uid) return
  clearTimeout(pushTimer)
  pushTimer = setTimeout(() => {
    if (state.uid && state.data) travelStateApi.put(state.data).catch(() => undefined)
  }, 1200)
}

async function pullOnce(targetUid: string) {
  if (pulledForUid === targetUid) return
  pulledForUid = targetUid
  try {
    const remote = await travelStateApi.get<Persisted>()
    if (state.uid !== targetUid) return
    if (remote && typeof remote === 'object') {
      state.data = normalize(remote)
      localStorage.setItem(storageKey(targetUid), JSON.stringify(state.data))
    } else if (state.data) {
      travelStateApi.put(state.data).catch(() => undefined)
    }
  } catch {
    pulledForUid = null
  }
}

/**
 * Shared plumbing: load the per-user state and keep it in sync. Every travel
 * composable (wallet / packing / itinerary) calls this so they all operate on
 * the same synced document. Idempotent across multiple callers.
 */
function useTravelState() {
  const auth = useAuthStore()
  const uid = computed(() => auth.firebaseUser?.uid ?? null)
  function ensureLoaded() {
    if (uid.value && state.uid !== uid.value) load(uid.value)
    if (uid.value) void pullOnce(uid.value)
  }
  ensureLoaded()
  watch(uid, ensureLoaded)
  const destinationId = computed<string>({
    get: () => state.data?.destinationId ?? destinations[0].id,
    set: (v: string) => {
      if (state.data) {
        state.data.destinationId = v
        persist()
      }
    },
  })
  const destination = computed<Destination>(() => destinationById(destinationId.value))
  return { destinationId, destination }
}

export function useTravelWallet() {
  const { destinationId, destination } = useTravelState()
  const currency = computed(() => destination.value.currency)

  // ---- Rate (per active currency) ----
  const rate = computed<number>({
    get: () => state.data?.rates[currency.value.code] ?? currency.value.defaultRate,
    set: (v: number) => {
      if (state.data) {
        state.data.rates[currency.value.code] = v
        persist()
      }
    },
  })

  // ---- Departure date ----
  const departDate = computed<string>({
    get: () => state.data?.departDate ?? '',
    set: (v: string) => {
      if (state.data) {
        state.data.departDate = v
        persist()
      }
    },
  })

  // ---- Expenses (scoped to the active currency) ----
  const items = computed(() => (state.data?.items ?? []).filter((e) => e.currency === currency.value.code))

  const totalForeign = computed(() => items.value.reduce((s, e) => s + e.amount, 0))
  const totalTwd = computed(() => Math.round(totalForeign.value * rate.value))

  const byCategory = computed(() => {
    const map = new Map<string, number>()
    for (const e of items.value) map.set(e.category, (map.get(e.category) ?? 0) + e.amount)
    return [...map.entries()]
      .map(([category, amount]) => ({
        category,
        amount,
        twd: Math.round(amount * rate.value),
        pct: totalForeign.value ? Math.round((amount / totalForeign.value) * 100) : 0,
      }))
      .sort((a, b) => b.amount - a.amount)
  })

  const sorted = computed(() =>
    [...items.value].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.id.localeCompare(a.id))),
  )

  function add(entry: { date: string; category: string; amount: number; note?: string }) {
    if (!state.data) return
    state.data.items.push({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      date: entry.date,
      category: entry.category,
      amount: entry.amount,
      currency: currency.value.code,
      note: entry.note?.trim() ?? '',
    })
    persist()
  }

  function remove(id: string) {
    if (!state.data) return
    state.data.items = state.data.items.filter((e) => e.id !== id)
    persist()
  }

  /** Clears only the active destination's expenses. */
  function clearAll() {
    if (!state.data) return
    state.data.items = state.data.items.filter((e) => e.currency !== currency.value.code)
    persist()
  }

  function toTwd(amount: number) {
    return Math.round(amount * rate.value)
  }

  // ---- Budget (per destination, in TWD) ----
  const budget = computed<number>({
    get: () => state.data?.budgets[destinationId.value] ?? 0,
    set: (v: number) => {
      if (state.data) {
        state.data.budgets[destinationId.value] = v > 0 ? v : 0
        persist()
      }
    },
  })
  const remainingTwd = computed(() => budget.value - totalTwd.value)
  const budgetPct = computed(() =>
    budget.value > 0 ? Math.min(100, Math.round((totalTwd.value / budget.value) * 100)) : 0,
  )
  const overBudget = computed(() => budget.value > 0 && totalTwd.value > budget.value)

  const rateLoading = ref(false)

  /** Fetch the live rate for the active currency and store it. Silent on failure. */
  async function refreshRate() {
    if (rateLoading.value) return
    rateLoading.value = true
    try {
      const r = await fxApi.rate(currency.value.code, 'TWD')
      rate.value = Math.round(r.rate * 1_000_000) / 1_000_000
      rateAsOf[currency.value.code] = r.asOf
    } catch {
      // keep the existing rate
    } finally {
      rateLoading.value = false
    }
  }

  return {
    destinations,
    destination,
    destinationId,
    currency,
    rate,
    rateAsOf,
    refreshRate,
    rateLoading,
    departDate,
    items,
    sorted,
    totalForeign,
    totalTwd,
    byCategory,
    budget,
    remainingTwd,
    budgetPct,
    overBudget,
    add,
    remove,
    clearAll,
    toTwd,
  }
}

// ---------------------------------------------------------------------------
// Packing checklist (per destination, synced)
// ---------------------------------------------------------------------------
const DEFAULT_PACKING = [
  '護照 / 簽證', '機票 / 訂房資訊', '現金 / 信用卡', '手機 + 充電線', '行動電源',
  '電源轉接頭 / 變壓器', '常用藥品', '盥洗用品', '換洗衣物', '雨具 / 外套',
]

export function useTravelPacking() {
  const { destination, destinationId } = useTravelState()

  function listFor(): PackingItem[] {
    if (!state.data) return []
    if (!state.data.packing[destinationId.value]) state.data.packing[destinationId.value] = []
    return state.data.packing[destinationId.value]
  }

  const items = computed<PackingItem[]>(() => state.data?.packing[destinationId.value] ?? [])
  const doneCount = computed(() => items.value.filter((x) => x.done).length)

  function add(label: string) {
    const t = label.trim()
    if (!t || !state.data) return
    listFor().push({ id: uid4(), label: t, done: false })
    persist()
  }
  function toggle(id: string) {
    const it = items.value.find((x) => x.id === id)
    if (it) {
      it.done = !it.done
      persist()
    }
  }
  function remove(id: string) {
    if (!state.data) return
    state.data.packing[destinationId.value] = listFor().filter((x) => x.id !== id)
    persist()
  }
  function clearDone() {
    if (!state.data) return
    state.data.packing[destinationId.value] = listFor().filter((x) => !x.done)
    persist()
  }
  function seedDefaults() {
    if (!state.data || listFor().length) return
    for (const label of DEFAULT_PACKING) listFor().push({ id: uid4(), label, done: false })
    persist()
  }

  return { destination, items, doneCount, add, toggle, remove, clearDone, seedDefaults }
}

// ---------------------------------------------------------------------------
// Itinerary (per destination, synced)
// ---------------------------------------------------------------------------
export function useItinerary() {
  const { destination, destinationId } = useTravelState()

  function listFor(): ItineraryItem[] {
    if (!state.data) return []
    if (!state.data.itinerary[destinationId.value]) state.data.itinerary[destinationId.value] = []
    return state.data.itinerary[destinationId.value]
  }

  const items = computed<ItineraryItem[]>(() =>
    (state.data?.itinerary[destinationId.value] ?? [])
      .slice()
      .sort((a, b) => a.day - b.day || a.time.localeCompare(b.time)),
  )

  /** Items grouped by day number, ascending. */
  const byDay = computed(() => {
    const map = new Map<number, ItineraryItem[]>()
    for (const it of items.value) {
      if (!map.has(it.day)) map.set(it.day, [])
      map.get(it.day)!.push(it)
    }
    return [...map.entries()].sort((a, b) => a[0] - b[0]).map(([day, list]) => ({ day, list }))
  })

  function add(entry: { day: number; time: string; place: string; note?: string }) {
    if (!state.data || !entry.place.trim()) return
    listFor().push({
      id: uid4(),
      day: entry.day,
      time: entry.time.trim(),
      place: entry.place.trim(),
      note: entry.note?.trim() ?? '',
    })
    persist()
  }
  function remove(id: string) {
    if (!state.data) return
    state.data.itinerary[destinationId.value] = listFor().filter((x) => x.id !== id)
    persist()
  }

  /** Cache geocoded coordinates onto an item (called by the map). */
  function setCoords(id: string, lat: number, lon: number) {
    const it = listFor().find((x) => x.id === id)
    if (it) {
      it.lat = lat
      it.lon = lon
      persist()
    }
  }

  return { destination, destinationId, items, byDay, add, remove, setCoords }
}

// ---------------------------------------------------------------------------
// Emergency-card trip info (per destination, synced)
// ---------------------------------------------------------------------------
export function useTripInfo() {
  const { destination, destinationId } = useTravelState()

  function current(): TripInfo {
    if (!state.data) return emptyTripInfo()
    if (!state.data.trip[destinationId.value]) state.data.trip[destinationId.value] = emptyTripInfo()
    return state.data.trip[destinationId.value]
  }

  const info = computed<TripInfo>(() => state.data?.trip[destinationId.value] ?? emptyTripInfo())

  function update(patch: Partial<TripInfo>) {
    if (!state.data) return
    Object.assign(current(), patch)
    persist()
  }

  /** Whether the user has filled in anything yet (drives the empty hint). */
  const hasInfo = computed(() => Object.values(info.value).some((v) => String(v).trim().length > 0))

  return { destination, destinationId, info, update, hasInfo }
}

// ---------------------------------------------------------------------------
// Travel journal (per destination, synced; photos in Firebase Storage)
// ---------------------------------------------------------------------------
export function useTravelJournal() {
  const { destination, destinationId } = useTravelState()

  function listFor(): JournalEntry[] {
    if (!state.data) return []
    if (!state.data.journal[destinationId.value]) state.data.journal[destinationId.value] = []
    return state.data.journal[destinationId.value]
  }

  // Newest first.
  const entries = computed<JournalEntry[]>(() =>
    (state.data?.journal[destinationId.value] ?? [])
      .slice()
      .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.id.localeCompare(a.id))),
  )

  const photoCount = computed(() => entries.value.reduce((n, e) => n + e.photoUrls.length, 0))

  function add(entry: { date: string; text: string; photoUrls?: string[] }): string {
    const id = uid4()
    if (!state.data) return id
    listFor().push({
      id,
      date: entry.date || new Date().toISOString().slice(0, 10),
      text: entry.text.trim(),
      photoUrls: entry.photoUrls ?? [],
    })
    persist()
    return id
  }

  function update(id: string, patch: Partial<Pick<JournalEntry, 'date' | 'text' | 'photoUrls'>>) {
    const e = listFor().find((x) => x.id === id)
    if (!e) return
    if (patch.date !== undefined) e.date = patch.date
    if (patch.text !== undefined) e.text = patch.text
    if (patch.photoUrls !== undefined) e.photoUrls = patch.photoUrls
    persist()
  }

  function addPhoto(id: string, url: string) {
    const e = listFor().find((x) => x.id === id)
    if (e && !e.photoUrls.includes(url)) {
      e.photoUrls.push(url)
      persist()
    }
  }

  function removePhoto(id: string, url: string) {
    const e = listFor().find((x) => x.id === id)
    if (e) {
      e.photoUrls = e.photoUrls.filter((u) => u !== url)
      persist()
    }
  }

  function remove(id: string) {
    if (!state.data) return
    state.data.journal[destinationId.value] = listFor().filter((x) => x.id !== id)
    persist()
  }

  return { destination, destinationId, entries, photoCount, add, update, addPhoto, removePhoto, remove }
}
