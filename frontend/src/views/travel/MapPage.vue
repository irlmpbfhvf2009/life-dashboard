<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { Loader2 } from 'lucide-vue-next'
import PageHeader from '@/components/ui/PageHeader.vue'
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

function escapeHtml(s: string) {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string))
}

function dayIcon(day: number) {
  const color = dayColors[(day - 1) % dayColors.length]
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
  if (pts.length) map.fitBounds(L.latLngBounds(pts).pad(0.2), { maxZoom: 15 })
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
      const r = await geoApi.search(`${it.place}, ${destination.value.city}`)
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

    <p v-if="geocoding" class="mb-3 flex items-center gap-1.5 text-sm text-ink-500">
      <Loader2 class="h-4 w-4 animate-spin" /> {{ $t('tv.map.locating', { done: progress.done, total: progress.total }) }}
    </p>

    <div class="card relative isolate overflow-hidden p-0">
      <div ref="mapEl" class="h-[62vh] w-full" />
    </div>

    <EmptyState
      v-if="!items.length"
      class="mt-4"
      :title="$t('tv.map.emptyTitle')"
      :description="$t('tv.map.emptyDesc')"
    />
  </div>
</template>
