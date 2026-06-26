<script setup lang="ts">
import type { Component } from 'vue'
withDefaults(
  defineProps<{
    label: string
    icon: Component
    tint?: 'indigo' | 'violet' | 'amber' | 'sky' | 'rose' | 'emerald'
  }>(),
  { tint: 'indigo' },
)
// Literal strings so Tailwind keeps the .tint-* rules (see StatCard).
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
  <button
    class="group flex flex-col items-start gap-3 rounded-2xl border border-ink-200 bg-surface p-4 text-left shadow-card transition-all hover:-translate-y-0.5 hover:border-ink-300 hover:shadow-card-hover ring-focus"
  >
    <span class="flex h-11 w-11 items-center justify-center rounded-2xl transition-transform group-hover:scale-105" :class="tintClass[tint]">
      <component :is="icon" class="h-5 w-5" :stroke-width="2" />
    </span>
    <span class="text-sm font-medium text-ink-700">{{ label }}</span>
  </button>
</template>
