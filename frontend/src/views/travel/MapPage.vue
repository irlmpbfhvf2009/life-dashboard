<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { Loader2, MapPin, CircleSlash } from 'lucide-vue-next'
import PageHeader from '@/components/ui/PageHeader.vue'
import SectionCard from '@/components/ui/SectionCard.vue'
import DestinationPicker from '@/components/travel/DestinationPicker.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import { useItinerary } from '@/composables/useTravelWallet'
import { geoApi } from '@/api'

const { t } = useI18n()
const itin = useItinerary()
const { destination, items } = itin

const mapEl = ref<HTMLElement | null>(null)
let map: L.Map | null = null
let layer: L.LayerGroup | null = null
const geocoding = ref(false)
const progress = ref({ done: 0, total: 0 })

const dayColors = ['#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6']
const dayColor = (day: number) => dayColors[(day - 1) % dayColors.length]

function escapeHtml(s: string) {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string))
}

// The Latin (English) part of the city name, which Nominatim handles best.
const latinCity = computed(() => destination.value.city.match(/[A-Za-z][A-Za-z\s.\-]*/)?.[0]?.trim() ?? destination.value.city)

// Build a clean geocoding query: prefer the English name in parentheses, else the
// first part before a separator, then add the city for context.
function geoQuery(place: string) {
  const paren = place.match(/\(([^)]*[A-Za-z][^)]*)\)/)
  let name = paren ? paren[1] : place.split(/[&、,，/／(（]/)[0]
  name = name.replace(/[（）()]/g, ' ').trim()
  return `${name}, ${latinCity.value}`
}

function dayIcon(day: number) {
  const color = dayColor(day)
  return L.divIcon({
    className: '',
    html:
      `<div style="background:${color};color:#fff;width:26px;height:26px;border-radius:50% 50% 50% 0;` +
      `transform:rotate(-45deg);display:flex;align-items:center;justify-content:center;` +
      `box-shadow:0 1px 4px rgba(0,0,0,.35);border:2px solid #fff;">` +
      `<span style="transform:rotate(45deg);font-size:12px;font-weight:700;">${day}</span></div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 26],
    popupAnchor: [0, -24],
  })
}

function render() {
  if (!map) return
  if (!layer) layer = L.layerGroup().addTo(map)
  layer.clearLayers()
  const pts: L.LatLngTuple[] = []
  for (const it of items.value) {
    if (it.lat == null || it.lon == null) continue
    const m = L.marker([it.lat, it.lon], { icon: dayIcon(it.day) })
    m.bindPopup(
      `<b>${escapeHtml(it.place)}</b><br>${t('tv.itinerary.dayLabel', { n: it.day })}` +
        (it.time ? ` · ${escapeHtml(it.time)}` : ''),
    )
    m.addTo(layer)
    pts.push([it.lat, it.lon])
  }
  if (pts.length) map.fitBounds(L.latLngBounds(pts).pad(0.25), { maxZoom: 14 })
  else map.setView([destination.value.lat, destination.value.lon], 12)
}

async function ensureCoords() {
  const todo = items.value.filter((it) => it.lat == null || it.lon == null)
  if (!todo.length) {
    render()
    return
  }
  geocoding.value = true
  progress.value = { done: 0, total: todo.length }
  for (const it of todo) {
    try {
      const r = await geoApi.search(geoQuery(it.place))
      if (r) itin.setCoords(it.id, r.lat, r.lon)
    } catch {
      /* skip places we can't locate */
    }
    progress.value.done++
    render()
    await new Promise((res) => setTimeout(res, 1100)) // respect Nominatim ~1 req/s
  }
  geocoding.value = false
  render()
}

const locatedCount = computed(() => items.value.filter((i) => i.lat != null).length)

onMounted(() => {
  if (!mapEl.value) return
  map = L.map(mapEl.value).setView([destination.value.lat, destination.value.lon], 12)
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors',
    maxZoom: 19,
  }).addTo(map)
  setTimeout(() => map?.invalidateSize(), 120)
  render()
  void ensureCoords()
})

watch(destination, () => {
  render()
  void ensureCoords()
})
watch(items, render, { deep: true })

onUnmounted(() => {
  map?.remove()
  map = null
  layer = null
})
</script>

<template>
  <div>
    <PageHeader eyebrow="Map" :title="$t('tv.map.title')" :subtitle="$t('tv.map.subtitle')" />

    <div class="mb-4">
      <DestinationPicker />
    </div>

    <EmptyState
      v-if="!items.length"
      class="mb-4"
      :icon="MapPin"
      :title="$t('tv.map.emptyTitle')"
      :description="$t('tv.map.emptyDesc')"
    />

    <template v-else>
      <!-- Legend + status -->
      <div class="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-500">
        <span class="inline-flex items-center gap-1.5">
          <span class="flex h-4 w-4 items-center justify-center rounded-full bg-brand-500 text-[9px] font-bold text-white">1</span>
          {{ $t('tv.map.legend') }}
        </span>
        <span v-if="geocoding" class="inline-flex items-center gap-1.5 text-ink-400">
          <Loader2 class="h-3.5 w-3.5 animate-spin" /> {{ $t('tv.map.locating', { done: progress.done, total: progress.total }) }}
        </span>
        <span v-else>{{ $t('tv.map.located', { n: locatedCount, total: items.length }) }}</span>
      </div>

      <div class="card relative isolate mb-6 overflow-hidden p-0">
        <div ref="mapEl" class="h-[58vh] w-full" />
      </div>

      <!-- Stops list (ties the map to the itinerary) -->
      <SectionCard :title="$t('tv.map.stops')" :icon="MapPin">
        <ul class="divide-y divide-ink-100">
          <li v-for="it in items" :key="it.id" class="flex items-center gap-3 py-2.5">
            <span class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white" :style="{ background: dayColor(it.day) }">{{ it.day }}</span>
            <span class="min-w-0 flex-1 truncate text-sm text-ink-800">{{ it.place }}</span>
            <span v-if="it.lat != null" class="inline-flex items-center gap-1 text-xs text-emerald-600">
              <MapPin class="h-3.5 w-3.5" /> {{ $t('tv.map.onMap') }}
            </span>
            <span v-else-if="geocoding" class="inline-flex items-center gap-1 text-xs text-ink-400">
              <Loader2 class="h-3.5 w-3.5 animate-spin" />
            </span>
            <span v-else class="inline-flex items-center gap-1 text-xs text-ink-400">
              <CircleSlash class="h-3.5 w-3.5" /> {{ $t('tv.map.notFound') }}
            </span>
          </li>
        </ul>
      </SectionCard>
    </template>
  </div>
</template>
