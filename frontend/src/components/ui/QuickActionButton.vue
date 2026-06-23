<script setup lang="ts">
import type { Component } from 'vue'
defineProps<{ label: string; icon: Component }>()
</script>

<template>
  <button
    class="group flex flex-col items-start gap-3 rounded-2xl border border-ink-200 bg-surface p-4 text-left shadow-card transition-all hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-card-hover ring-focus"
  >
    <span class="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600 transition-colors group-hover:bg-brand-600 group-hover:text-white">
      <component :is="icon" class="h-5 w-5" :stroke-width="2" />
    </span>
    <span class="text-sm font-medium text-ink-700">{{ label }}</span>
  </button>
</template>
