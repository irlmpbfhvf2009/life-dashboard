<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { Plane, MapPin, ExternalLink, Printer, CalendarDays, Loader2, Compass } from 'lucide-vue-next'
import TripMap, { type MapStop } from '@/components/travel/TripMap.vue'
import { publicTripApi } from '@/api'

interface SnapStop {
  id: string
  day: number
  time: string
  place: string
  note: string
  lat?: number
  lon?: number
}
interface Snapshot {
  destination: { id: string; country: string; city: string; flag: string; lat: number; lon: number }
  departDate: string
  itinerary: SnapStop[]
  createdAt?: string
}

const route = useRoute()
const token = String(route.params.token ?? '')
const snap = ref<Snapshot | null>(null)
const loading = ref(true)
const notFound = ref(false)

const stops = computed<MapStop[]>(() =>
  (snap.value?.itinerary ?? []).map((it) => ({ id: it.id, day: it.day, place: it.place, time: it.time, lat: it.lat, lon: it.lon })),
)
const center = computed(() => ({ lat: snap.value?.destination.lat ?? 0, lon: snap.value?.destination.lon ?? 0 }))
const located = computed(() => stops.value.filter((s) => s.lat != null).length)

const byDay = computed(() => {
  const map = new Map<number, SnapStop[]>()
  for (const it of snap.value?.itinerary ?? []) {
    if (!map.has(it.day)) map.set(it.day, [])
    map.get(it.day)!.push(it)
  }
  return [...map.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([day, list]) => ({ day, list: list.slice().sort((a, b) => a.time.localeCompare(b.time)) }))
})

function dayDate(day: number): string {
  if (!snap.value?.departDate) return ''
  const d = new Date(`${snap.value.departDate}T00:00:00`)
  d.setDate(d.getDate() + (day - 1))
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', weekday: 'short' })
}

function mapUrl(place: string) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place)}`
}

function printPage() {
  window.print()
}

onMounted(async () => {
  try {
    const data = await publicTripApi.get<Snapshot>(token)
    if (data && data.destination) snap.value = data
    else notFound.value = true
  } catch {
    notFound.value = true
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="min-h-screen bg-ink-50 text-ink-800">
    <!-- Top bar -->
    <header class="no-print sticky top-0 z-10 border-b border-ink-200 bg-surface/90 backdrop-blur">
      <div class="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
        <span class="inline-flex items-center gap-2 text-sm font-semibold text-ink-700">
          <Compass class="h-4 w-4 text-brand-600" /> {{ $t('tv.share.brand') }}
        </span>
        <button v-if="snap" class="btn-secondary !h-9 !px-3 text-sm" @click="printPage">
          <Printer class="h-4 w-4" /> {{ $t('tv.share.print') }}
        </button>
      </div>
    </header>

    <main class="mx-auto max-w-3xl px-4 py-6">
      <div v-if="loading" class="flex items-center justify-center gap-2 py-24 text-ink-400">
        <Loader2 class="h-5 w-5 animate-spin" /> {{ $t('tv.common.loading') }}
      </div>

      <div v-else-if="notFound || !snap" class="flex flex-col items-center justify-center gap-3 py-24 text-center">
        <span class="flex h-14 w-14 items-center justify-center rounded-2xl bg-ink-100 text-ink-400">
          <MapPin class="h-7 w-7" />
        </span>
        <h1 class="text-lg font-semibold text-ink-800">{{ $t('tv.share.notFoundTitle') }}</h1>
        <p class="text-sm text-ink-500">{{ $t('tv.share.notFoundDesc') }}</p>
      </div>

      <template v-else>
        <!-- Hero -->
        <div class="overflow-hidden rounded-2xl border border-ink-200 bg-gradient-to-br from-brand-500 to-brand-700 p-6 text-white">
          <div class="flex items-center gap-2 text-white/80">
            <Plane class="h-4 w-4" />
            <span class="text-sm font-medium">{{ $t('tv.share.heroEyebrow') }}</span>
          </div>
          <h1 class="mt-1 text-2xl font-bold tracking-tight">{{ snap.destination.flag }} {{ snap.destination.country }}・{{ snap.destination.city }}</h1>
          <p v-if="snap.departDate" class="mt-1 inline-flex items-center gap-1.5 text-sm text-white/80">
            <CalendarDays class="h-4 w-4" /> {{ new Date(snap.departDate).toLocaleDateString() }} {{ $t('tv.share.departs') }}
          </p>
        </div>

        <!-- Map -->
        <div v-if="located" class="mt-6">
          <TripMap :stops="stops" :center="center" height-class="h-[46vh]" />
          <p class="mt-2 text-xs text-ink-400">{{ $t('tv.map.located', { n: located, total: stops.length }) }}</p>
        </div>

        <!-- Itinerary by day -->
        <div class="mt-6 space-y-5">
          <section v-for="grp in byDay" :key="grp.day" class="rounded-2xl border border-ink-200 bg-surface p-5">
            <div class="mb-3 flex items-center justify-between">
              <h2 class="text-sm font-semibold text-ink-800">{{ $t('tv.itinerary.dayLabel', { n: grp.day }) }}</h2>
              <span v-if="dayDate(grp.day)" class="text-xs text-ink-400">{{ dayDate(grp.day) }}</span>
            </div>
            <ul class="divide-y divide-ink-100">
              <li v-for="it in grp.list" :key="it.id" class="py-3">
                <div class="flex items-center gap-2">
                  <span v-if="it.time" class="rounded bg-brand-50 px-1.5 py-0.5 text-xs font-medium text-brand-700">{{ it.time }}</span>
                  <a :href="mapUrl(it.place)" target="_blank" rel="noopener" class="inline-flex items-center gap-1 text-sm font-semibold text-ink-800 hover:text-brand-600">
                    <MapPin class="h-3.5 w-3.5 shrink-0 text-ink-400" />
                    {{ it.place }}
                    <ExternalLink class="no-print h-3 w-3 text-ink-300" />
                  </a>
                </div>
                <p v-if="it.note" class="mt-0.5 pl-5 text-xs text-ink-500">{{ it.note }}</p>
              </li>
            </ul>
          </section>
        </div>

        <p class="no-print mt-8 text-center text-xs text-ink-400">{{ $t('tv.share.footer') }}</p>
      </template>
    </main>
  </div>
</template>

<style scoped>
@media print {
  .no-print { display: none !important; }
}
</style>
