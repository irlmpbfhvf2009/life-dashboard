<script setup lang="ts">
import { computed } from 'vue'
import type { Component } from 'vue'

const props = withDefaults(
  defineProps<{
    title: string
    icon?: Component
    value: number
    max: number
    unit?: string
    caption?: string
    accent?: 'brand' | 'emerald' | 'amber' | 'rose'
  }>(),
  { accent: 'brand', unit: '' },
)

const percent = computed(() =>
  props.max > 0 ? Math.min(100, Math.round((props.value / props.max) * 100)) : 0,
)
const barClass: Record<string, string> = {
  brand: 'bg-brand-500',
  emerald: 'bg-emerald-500',
  amber: 'bg-amber-500',
  rose: 'bg-rose-500',
}
</script>

<template>
  <div class="card p-5">
    <div class="mb-3 flex items-center gap-2.5">
      <component :is="icon" v-if="icon" class="h-4 w-4 text-ink-400" :stroke-width="2" />
      <h3 class="section-title">{{ title }}</h3>
    </div>
    <div class="flex items-end justify-between">
      <p class="text-2xl font-bold tracking-tight text-ink-900">
        {{ value }}<span class="ml-1 text-sm font-medium text-ink-400">{{ unit }}</span>
      </p>
      <span class="text-sm font-semibold text-ink-500">{{ percent }}%</span>
    </div>
    <div class="mt-3 h-2 w-full overflow-hidden rounded-full bg-ink-100">
      <div class="h-full rounded-full transition-all" :class="barClass[accent]" :style="{ width: percent + '%' }" />
    </div>
    <p v-if="caption" class="mt-2 text-xs text-ink-400">{{ caption }}</p>
  </div>
</template>
