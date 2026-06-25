<script setup lang="ts">
// Presentational Leaflet map: drops day-numbered markers for itinerary stops
// that already have coordinates and frames them. No geocoding here — callers
// pass stops with lat/lon (the itinerary map geocodes; the public share view
// reads them from a baked snapshot). Reused by MapPage and PublicTripView.
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

export interface MapStop {
  id: string
  day: number
  place: string
  time?: string
  lat?: number
  lon?: number
}

const props = withDefaults(
  defineProps<{
    stops: MapStop[]
    center: { lat: number; lon: number }
    heightClass?: string
  }>(),
  { heightClass: 'h-[58vh]' },
)

const { t } = useI18n()
const mapEl = ref<HTMLElement | null>(null)
let map: L.Map | null = null
let layer: L.LayerGroup | null = null

const dayColors = ['#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6']
const dayColor = (day: number) => dayColors[(day - 1) % dayColors.length]

function escapeHtml(s: string) {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string))
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
  for (const it of props.stops) {
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
  else map.setView([props.center.lat, props.center.lon], 12)
}

onMounted(() => {
  if (!mapEl.value) return
  map = L.map(mapEl.value).setView([props.center.lat, props.center.lon], 12)
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors',
    maxZoom: 19,
  }).addTo(map)
  setTimeout(() => map?.invalidateSize(), 120)
  render()
})

watch(() => props.stops, render, { deep: true })
watch(() => props.center, render)

onUnmounted(() => {
  map?.remove()
  map = null
  layer = null
})

defineExpose({ dayColor })
</script>

<template>
  <div class="card relative isolate overflow-hidden p-0">
    <div ref="mapEl" :class="heightClass" class="w-full" />
  </div>
</template>
