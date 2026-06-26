<script setup lang="ts">
import { computed, reactive, ref, onMounted, onBeforeUnmount } from 'vue'
import type { Ohlc } from '@/types/stock'

const props = defineProps<{
  ohlc: Ohlc[]
  ma60?: number // 季線 reference
  ma240?: number // 年線 reference
}>()

// Measure the real container width so the chart maps 1:1 (no horizontal stretch).
const wrapRef = ref<HTMLElement | null>(null)
const W = ref(680)
const H = 210
const PAD = { t: 14, r: 10, b: 20, l: 10 }
let ro: ResizeObserver | null = null

onMounted(() => {
  if (wrapRef.value) {
    W.value = wrapRef.value.clientWidth || 680
    ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width
      if (w) W.value = Math.round(w)
    })
    ro.observe(wrapRef.value)
  }
})
onBeforeUnmount(() => ro?.disconnect())

const show = reactive({ ma5: true, ma20: true, ma60: true, ma240: true })

const UP = '#e11d48' // 漲 red
const DOWN = '#059669' // 跌 green
const MA5_C = '#f59e0b'
const MA20_C = '#3b82f6'

function sma(values: number[], period: number): (number | null)[] {
  const out: (number | null)[] = []
  let sum = 0
  for (let i = 0; i < values.length; i++) {
    sum += values[i]
    if (i >= period) sum -= values[i - period]
    out.push(i >= period - 1 ? sum / period : null)
  }
  return out
}

const closes = computed(() => props.ohlc.map((o) => o[4]))
const ma5 = computed(() => sma(closes.value, 5))
const ma20 = computed(() => sma(closes.value, 20))

const bounds = computed(() => {
  const vals: number[] = []
  for (const o of props.ohlc) vals.push(o[2], o[3])
  if (show.ma60 && props.ma60) vals.push(props.ma60)
  if (show.ma240 && props.ma240) vals.push(props.ma240)
  const min = Math.min(...vals)
  const max = Math.max(...vals)
  const pad = (max - min) * 0.06 || 1
  return { min: min - pad, max: max + pad }
})

const innerW = computed(() => W.value - PAD.l - PAD.r)
const innerH = H - PAD.t - PAD.b
const n = computed(() => props.ohlc.length)
const step = computed(() => innerW.value / Math.max(1, n.value))
const candleW = computed(() => Math.max(1.5, Math.min(9, step.value * 0.62)))

function xOf(i: number) {
  return PAD.l + step.value * (i + 0.5)
}
function yOf(v: number) {
  const { min, max } = bounds.value
  return PAD.t + innerH * (1 - (v - min) / (max - min || 1))
}

const candles = computed(() =>
  props.ohlc.map((o, i) => {
    const [, open, high, low, close] = o
    const up = close >= open
    return {
      x: xOf(i),
      yHigh: yOf(high),
      yLow: yOf(low),
      yTop: yOf(Math.max(open, close)),
      yBot: yOf(Math.min(open, close)),
      color: up ? UP : DOWN,
    }
  }),
)

function polyline(series: (number | null)[]) {
  return series
    .map((v, i) => (v == null ? null : `${xOf(i).toFixed(1)},${yOf(v).toFixed(1)}`))
    .filter(Boolean)
    .join(' ')
}
const ma5Line = computed(() => polyline(ma5.value))
const ma20Line = computed(() => polyline(ma20.value))

const xLabels = computed(() => {
  const out: { x: number; text: string }[] = []
  const k = Math.ceil(n.value / 6)
  props.ohlc.forEach((o, i) => {
    if (i % k === 0) out.push({ x: xOf(i), text: o[0] })
  })
  return out
})

const legend = [
  { key: 'ma5' as const, label: 'MA5', color: MA5_C },
  { key: 'ma20' as const, label: '月線', color: MA20_C },
  { key: 'ma60' as const, label: '季線', color: '#94a3b8' },
  { key: 'ma240' as const, label: '年線', color: '#cbd5e1' },
]
</script>

<template>
  <div ref="wrapRef">
    <svg :viewBox="`0 0 ${W} ${H}`" :width="W" :height="H" class="max-w-full">
      <template v-if="show.ma60 && ma60">
        <line :x1="PAD.l" :x2="W - PAD.r" :y1="yOf(ma60)" :y2="yOf(ma60)" stroke="#94a3b8" stroke-dasharray="4 4" stroke-width="1" />
        <text :x="PAD.l + 2" :y="yOf(ma60) - 3" fill="#94a3b8" font-size="9">季線 {{ ma60 }}</text>
      </template>
      <template v-if="show.ma240 && ma240">
        <line :x1="PAD.l" :x2="W - PAD.r" :y1="yOf(ma240)" :y2="yOf(ma240)" stroke="#cbd5e1" stroke-dasharray="4 4" stroke-width="1" />
        <text :x="PAD.l + 2" :y="yOf(ma240) - 3" fill="#cbd5e1" font-size="9">年線 {{ ma240 }}</text>
      </template>

      <g v-for="(c, i) in candles" :key="i">
        <line :x1="c.x" :x2="c.x" :y1="c.yHigh" :y2="c.yLow" :stroke="c.color" stroke-width="1" />
        <rect :x="c.x - candleW / 2" :y="c.yTop" :width="candleW" :height="Math.max(1, c.yBot - c.yTop)" :fill="c.color" />
      </g>

      <polyline v-if="show.ma5" :points="ma5Line" fill="none" :stroke="MA5_C" stroke-width="1.4" />
      <polyline v-if="show.ma20" :points="ma20Line" fill="none" :stroke="MA20_C" stroke-width="1.4" />

      <text v-for="(l, i) in xLabels" :key="i" :x="l.x" :y="H - 5" class="fill-ink-400" font-size="9" text-anchor="middle">{{ l.text }}</text>
    </svg>

    <div class="mt-2 flex flex-wrap items-center gap-3 text-2xs">
      <span class="text-ink-400">點圖例切換：</span>
      <button v-for="l in legend" :key="l.key" class="inline-flex items-center gap-1 transition-opacity" :class="{ 'opacity-35': !show[l.key] }" @click="show[l.key] = !show[l.key]">
        <span class="h-2 w-3 rounded-sm" :style="{ background: l.color }" />{{ l.label }}
      </button>
      <span class="ml-2 inline-flex items-center gap-1 text-ink-400"><span class="h-2 w-2 rounded-sm" :style="{ background: UP }" />漲</span>
      <span class="inline-flex items-center gap-1 text-ink-400"><span class="h-2 w-2 rounded-sm" :style="{ background: DOWN }" />跌</span>
    </div>
  </div>
</template>
