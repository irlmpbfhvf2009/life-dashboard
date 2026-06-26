<script setup lang="ts">
import type { Component } from 'vue'
import { TrendingUp, TrendingDown } from 'lucide-vue-next'

withDefaults(
  defineProps<{
    label: string
    value: string | number
    sub?: string
    icon?: Component
    trend?: { dir: 'up' | 'down'; value: string; good?: boolean }
    /** Icon chip colour. Defaults to the brand indigo. */
    tint?: 'indigo' | 'violet' | 'amber' | 'sky' | 'rose' | 'emerald'
    /** Show a pulsing skeleton in place of the value while data loads. */
    loading?: boolean
  }>(),
  { tint: 'indigo' },
)

// Literal class strings so Tailwind's content scanner keeps the .tint-* rules
// (a constructed `tint-${tint}` name would be purged from the build).
const tintClass: Record<string, string> = {
  indigo: 'tint-indigo',
  violet: 'tint-violet',
  amber: 'tint-amber',
  sky: 'tint-sky',
  rose: 'tint-rose',
  emerald: 'tint-emerald',
}
</script>

<template>
  <div class="card card-hover p-5">
    <div class="flex items-center justify-between">
      <p class="text-sm font-medium text-ink-500">{{ label }}</p>
      <div v-if="icon" class="flex h-9 w-9 items-center justify-center rounded-xl" :class="tintClass[tint]">
        <component :is="icon" class="h-[18px] w-[18px]" :stroke-width="2" />
      </div>
    </div>
    <div v-if="loading" class="mt-3.5 h-7 w-20 animate-pulse rounded-lg bg-ink-100" />
    <p v-else class="mt-3 text-2xl font-bold tracking-tight text-ink-900">{{ value }}</p>
    <div class="mt-1.5 flex items-center gap-2">
      <div v-if="loading" class="h-3.5 w-24 animate-pulse rounded bg-ink-100" />
      <span
        v-else-if="trend"
        class="inline-flex items-center gap-0.5 text-xs font-semibold"
        :class="trend.good === false ? 'text-rose-600' : 'text-emerald-600'"
      >
        <component :is="trend.dir === 'up' ? TrendingUp : TrendingDown" class="h-3.5 w-3.5" />
        {{ trend.value }}
      </span>
      <span v-if="sub && !loading" class="text-xs text-ink-400">{{ sub }}</span>
    </div>
  </div>
</template>
