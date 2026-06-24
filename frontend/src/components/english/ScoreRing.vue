<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    value: number // 0-100
    size?: number
    stroke?: number
    label?: string
    suffix?: string
  }>(),
  { size: 96, stroke: 8, suffix: '' },
)

const radius = computed(() => (props.size - props.stroke) / 2)
const circumference = computed(() => 2 * Math.PI * radius.value)
const offset = computed(() => circumference.value * (1 - Math.max(0, Math.min(100, props.value)) / 100))

// Color shifts with score — amber low, brand mid, emerald high (never red/green
// pairing that would clash with the 台股 price convention).
const color = computed(() => (props.value >= 80 ? '#10b981' : props.value >= 50 ? '#6366f1' : '#f59e0b'))
</script>

<template>
  <div class="relative inline-flex items-center justify-center" :style="{ width: size + 'px', height: size + 'px' }">
    <svg :width="size" :height="size" class="-rotate-90">
      <circle :cx="size / 2" :cy="size / 2" :r="radius" :stroke-width="stroke" fill="none" class="stroke-ink-100" />
      <circle
        :cx="size / 2" :cy="size / 2" :r="radius" :stroke-width="stroke" fill="none"
        :stroke="color" stroke-linecap="round"
        :stroke-dasharray="circumference" :stroke-dashoffset="offset"
        style="transition: stroke-dashoffset 0.6s ease"
      />
    </svg>
    <div class="absolute inset-0 flex flex-col items-center justify-center">
      <span class="text-xl font-bold tracking-tight text-ink-900">{{ Math.round(value) }}<span class="text-xs font-medium text-ink-400">{{ suffix }}</span></span>
      <span v-if="label" class="text-[11px] text-ink-400">{{ label }}</span>
    </div>
  </div>
</template>
