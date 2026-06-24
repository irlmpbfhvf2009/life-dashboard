<script setup lang="ts">
import type { Component } from 'vue'
import ScoreRing from './ScoreRing.vue'

defineProps<{
  label: string
  value: string | number
  sub?: string
  icon?: Component
  ring?: number // optional 0-100 progress ring instead of a plain value
  accent?: string // tailwind text color for the icon chip
}>()
</script>

<template>
  <div class="card p-5">
    <div class="flex items-center justify-between">
      <p class="text-sm font-medium text-ink-500">{{ label }}</p>
      <div v-if="icon" class="flex h-8 w-8 items-center justify-center rounded-lg bg-ink-50" :class="accent || 'text-ink-400'">
        <component :is="icon" class="h-4 w-4" :stroke-width="2" />
      </div>
    </div>
    <div class="mt-3 flex items-center gap-3">
      <ScoreRing v-if="ring != null" :value="ring" :size="56" :stroke="6" suffix="%" />
      <div>
        <p class="text-2xl font-bold tracking-tight text-ink-900">{{ value }}</p>
        <p v-if="sub" class="mt-0.5 text-xs text-ink-400">{{ sub }}</p>
      </div>
    </div>
  </div>
</template>
