// Per-user, multi-country trip wallet. Cloud sync plumbing lives in
// useCloudSyncStore; this file owns the shared travel document shape/migration
// and five domain composables (wallet / packing / itinerary / trip info /
// journal) that all read and write the same synced document.
//
// Each expense is recorded in the active destination's currency; switching
// destination shows that currency's expenses, with a per-currency editable rate.

import { computed, reactive, ref } from 'vue'
import { travelStateApi, fxApi } from '@/api'
import { destinations, destinationById, type Destination } from '@/data/destinations'
import { useCloudSyncStore } from './useCloudSyncStore'

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

function freshState(): Persisted {
  return {
    items: [], rates: {}, departDate: '', destinationId: destinations[0].id,
    packing: {}, itinerary: {}, budgets: {}, trip: {}, journal: {},
  }
}

/** Upgrade any previously-stored shape (incl. the THB-only version) to Persisted. */
function normalizeShape(raw: Record<string, unknown>): Persisted {
  const base = freshState()
  const items: TripExpense[] = Array.isArray(raw.items)
    ? (raw.items as Record<string, unknown>[]).map((e) => ({
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
    raw.rates && typeof raw.rates === 'object' ? { ...(raw.rates as Record<string, number>) } : {}
  // Legacy single-rate field.
  if (typeof raw.thbToTwd === 'number' && rates.THB == null) rates.THB = raw.thbToTwd as number

  const packing = (raw.packing && typeof raw.packing === 'object' ? raw.packing : {}) as Record<string, PackingItem[]>
  const itinerary = (raw.itinerary && typeof raw.itinerary === 'object' ? raw.itinerary : {}) as Record<string, ItineraryItem[]>
  const budgets = (raw.budgets && typeof raw.budgets === 'object' ? raw.budgets : {}) as Record<string, number>
  const trip = (raw.trip && typeof raw.trip === 'object' ? raw.trip : {}) as Record<string, TripInfo>
  const journal = (raw.journal && typeof raw.journal === 'object' ? raw.journal : {}) as Record<string, JournalEntry[]>

  return {
    items,
    rates,
    departDate: typeof raw.departDate === 'string' ? raw.departDate : '',
    destinationId: typeof raw.destinationId === 'string' ? raw.destinationId : base.destinationId,
    packing,
    itinerary,
    budgets,
    trip,
    journal,
  }
}

function normalize(raw: Persisted | null | undefined): Persisted | null {
  if (!raw || typeof raw !== 'object') return null
  return normalizeShape(raw as unknown as Record<string, unknown>)
}

/** Import data saved under the original device-local keys (pre per-user sync). */
function migrateLegacy(): Persisted | null {
  try {
    const items = localStorage.getItem('travel.tripExpenses')
    const rate = localStorage.getItem('travel.thbToTwd')
    const depart = localStorage.getItem('travel.departDate')
    if (!items && !rate && !depart) return null
    return normalizeShape({
      items: items ? JSON.parse(items) : [],
      thbToTwd: rate ? JSON.parse(rate) : undefined,
      departDate: depart ?? '',
    })
  } catch {
    return null
  }
}

const uid4 = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`

const cloud = useCloudSyncStoreSingleton()

// `useCloudSyncStore` calls `useAuthStore()`, which needs Pinia already
// installed — wrap it so it's only constructed lazily, the first time any
// travel composable is actually used (mirrors the other stores' timing).
function useCloudSyncStoreSingleton() {
  let instance: ReturnType<typeof useCloudSyncStore<Persisted>> | null = null
  return () => {
    if (!instance) {
      instance = useCloudSyncStore<Persisted>({
        namespace: 'travel',
        api: travelStateApi,
        createDefault: () => migrateLegacy() ?? freshState(),
        normalize,
        pushDebounceMs: 1200,
      })
    }
    return instance
  }
}

/**
 * Shared plumbing: load the per-user state and keep it in sync. Every travel
 * composable (wallet / packing / itinerary / ...) calls this so they all
 * operate on the same synced document.
 */
function useTravelState() {
  const cs = cloud()
  const destinationId = computed<string>({
    get: () => cs.data.value?.destinationId ?? destinations[0].id,
    set: (v: string) => cs.update((d) => { d.destinationId = v }),
  })
  const destination = computed<Destination>(() => destinationById(destinationId.value))
  return { cs, destinationId, destination }
}

export function useTravelWallet() {
  const { cs, destinationId, destination } = useTravelState()
  const currency = computed(() => destination.value.currency)

  // ---- Rate (per active currency) ----
  const rate = computed<number>({
    get: () => cs.data.value?.rates[currency.value.code] ?? currency.value.defaultRate,
    set: (v: number) => cs.update((d) => { d.rates[currency.value.code] = v }),
  })

  // ---- Departure date ----
  const departDate = computed<string>({
    get: () => cs.data.value?.departDate ?? '',
    set: (v: string) => cs.update((d) => { d.departDate = v }),
  })

  // ---- Expenses (scoped to the active currency) ----
  const items = computed(() => (cs.data.value?.items ?? []).filter((e) => e.currency === currency.value.code))

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
    cs.update((d) => {
      d.items.push({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        date: entry.date,
        category: entry.category,
        amount: entry.amount,
        currency: currency.value.code,
        note: entry.note?.trim() ?? '',
      })
    })
  }

  function remove(id: string) {
    cs.update((d) => { d.items = d.items.filter((e) => e.id !== id) })
  }

  /** Clears only the active destination's expenses. */
  function clearAll() {
    cs.update((d) => { d.items = d.items.filter((e) => e.currency !== currency.value.code) })
  }

  function toTwd(amount: number) {
    return Math.round(amount * rate.value)
  }

  // ---- Budget (per destination, in TWD) ----
  const budget = computed<number>({
    get: () => cs.data.value?.budgets[destinationId.value] ?? 0,
    set: (v: number) => cs.update((d) => { d.budgets[destinationId.value] = v > 0 ? v : 0 }),
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
  const { cs, destination, destinationId } = useTravelState()

  function ensureList(d: Persisted): PackingItem[] {
    if (!d.packing[destinationId.value]) d.packing[destinationId.value] = []
    return d.packing[destinationId.value]
  }

  const items = computed<PackingItem[]>(() => cs.data.value?.packing[destinationId.value] ?? [])
  const doneCount = computed(() => items.value.filter((x) => x.done).length)

  function add(label: string) {
    const t = label.trim()
    if (!t) return
    cs.update((d) => { ensureList(d).push({ id: uid4(), label: t, done: false }) })
  }
  function toggle(id: string) {
    cs.update((d) => {
      const it = ensureList(d).find((x) => x.id === id)
      if (it) it.done = !it.done
    })
  }
  function remove(id: string) {
    cs.update((d) => { d.packing[destinationId.value] = ensureList(d).filter((x) => x.id !== id) })
  }
  function clearDone() {
    cs.update((d) => { d.packing[destinationId.value] = ensureList(d).filter((x) => !x.done) })
  }
  function seedDefaults() {
    cs.update((d) => {
      const list = ensureList(d)
      if (list.length) return
      for (const label of DEFAULT_PACKING) list.push({ id: uid4(), label, done: false })
    })
  }

  return { destination, items, doneCount, add, toggle, remove, clearDone, seedDefaults }
}

// ---------------------------------------------------------------------------
// Itinerary (per destination, synced)
// ---------------------------------------------------------------------------
export function useItinerary() {
  const { cs, destination, destinationId } = useTravelState()

  function ensureList(d: Persisted): ItineraryItem[] {
    if (!d.itinerary[destinationId.value]) d.itinerary[destinationId.value] = []
    return d.itinerary[destinationId.value]
  }

  const items = computed<ItineraryItem[]>(() =>
    (cs.data.value?.itinerary[destinationId.value] ?? [])
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
    if (!entry.place.trim()) return
    cs.update((d) => {
      ensureList(d).push({
        id: uid4(),
        day: entry.day,
        time: entry.time.trim(),
        place: entry.place.trim(),
        note: entry.note?.trim() ?? '',
      })
    })
  }
  function remove(id: string) {
    cs.update((d) => { d.itinerary[destinationId.value] = ensureList(d).filter((x) => x.id !== id) })
  }

  /** Cache geocoded coordinates onto an item (called by the map). */
  function setCoords(id: string, lat: number, lon: number) {
    cs.update((d) => {
      const it = ensureList(d).find((x) => x.id === id)
      if (it) { it.lat = lat; it.lon = lon }
    })
  }

  return { destination, destinationId, items, byDay, add, remove, setCoords }
}

// ---------------------------------------------------------------------------
// Emergency-card trip info (per destination, synced)
// ---------------------------------------------------------------------------
export function useTripInfo() {
  const { cs, destination, destinationId } = useTravelState()

  function ensureInfo(d: Persisted): TripInfo {
    if (!d.trip[destinationId.value]) d.trip[destinationId.value] = emptyTripInfo()
    return d.trip[destinationId.value]
  }

  const info = computed<TripInfo>(() => cs.data.value?.trip[destinationId.value] ?? emptyTripInfo())

  function update(patch: Partial<TripInfo>) {
    cs.update((d) => { Object.assign(ensureInfo(d), patch) })
  }

  /** Whether the user has filled in anything yet (drives the empty hint). */
  const hasInfo = computed(() => Object.values(info.value).some((v) => String(v).trim().length > 0))

  return { destination, destinationId, info, update, hasInfo }
}

// ---------------------------------------------------------------------------
// Travel journal (per destination, synced; photos in Firebase Storage)
// ---------------------------------------------------------------------------
export function useTravelJournal() {
  const { cs, destination, destinationId } = useTravelState()

  function ensureList(d: Persisted): JournalEntry[] {
    if (!d.journal[destinationId.value]) d.journal[destinationId.value] = []
    return d.journal[destinationId.value]
  }

  // Newest first.
  const entries = computed<JournalEntry[]>(() =>
    (cs.data.value?.journal[destinationId.value] ?? [])
      .slice()
      .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.id.localeCompare(a.id))),
  )

  const photoCount = computed(() => entries.value.reduce((n, e) => n + e.photoUrls.length, 0))

  function add(entry: { date: string; text: string; photoUrls?: string[] }): string {
    const id = uid4()
    cs.update((d) => {
      ensureList(d).push({
        id,
        date: entry.date || new Date().toISOString().slice(0, 10),
        text: entry.text.trim(),
        photoUrls: entry.photoUrls ?? [],
      })
    })
    return id
  }

  function update(id: string, patch: Partial<Pick<JournalEntry, 'date' | 'text' | 'photoUrls'>>) {
    cs.update((d) => {
      const e = ensureList(d).find((x) => x.id === id)
      if (!e) return
      if (patch.date !== undefined) e.date = patch.date
      if (patch.text !== undefined) e.text = patch.text
      if (patch.photoUrls !== undefined) e.photoUrls = patch.photoUrls
    })
  }

  function addPhoto(id: string, url: string) {
    cs.update((d) => {
      const e = ensureList(d).find((x) => x.id === id)
      if (e && !e.photoUrls.includes(url)) e.photoUrls.push(url)
    })
  }

  function removePhoto(id: string, url: string) {
    cs.update((d) => {
      const e = ensureList(d).find((x) => x.id === id)
      if (e) e.photoUrls = e.photoUrls.filter((u) => u !== url)
    })
  }

  function remove(id: string) {
    cs.update((d) => { d.journal[destinationId.value] = ensureList(d).filter((x) => x.id !== id) })
  }

  return { destination, destinationId, entries, photoCount, add, update, addPhoto, removePhoto, remove }
}
