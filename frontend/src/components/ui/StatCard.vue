<script setup lang="ts">
import type { Component } from 'vue'
import { TrendingUp, TrendingDown } from 'lucide-vue-next'

defineProps<{
  label: string
  value: string | number
  sub?: string
  icon?: Component
  trend?: { dir: 'up' | 'down'; value: string; good?: boolean }
}>()
</script>

<template>
  <div class="card card-hover p-5">
    <div class="flex items-center justify-between">
      <p class="text-sm font-medium text-ink-500">{{ label }}</p>
      <div v-if="icon" class="flex h-8 w-8 items-center justify-center rounded-lg bg-ink-50 text-ink-400">
        <component :is="icon" class="h-4 w-4" :stroke-width="2" />
      </div>
    </div>
    <p class="mt-3 text-2xl font-bold tracking-tight text-ink-900">{{ value }}</p>
    <div class="mt-1.5 flex items-center gap-2">
      <span
        v-if="trend"
        class="inline-flex items-center gap-0.5 text-xs font-semibold"
        :class="trend.good === false ? 'text-rose-600' : 'text-emerald-600'"
      >
        <component :is="trend.dir === 'up' ? TrendingUp : TrendingDown" class="h-3.5 w-3.5" />
        {{ trend.value }}
      </span>
      <span v-if="sub" class="text-xs text-ink-400">{{ sub }}</span>
    </div>
  </div>
</template>
