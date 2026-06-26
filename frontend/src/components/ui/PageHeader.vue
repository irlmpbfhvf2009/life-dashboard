<script setup lang="ts">
import type { Component } from 'vue'
defineProps<{ title: string; subtitle?: string; eyebrow?: string; icon?: Component }>()
</script>

<template>
  <div class="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
    <div class="flex items-center gap-3.5">
      <span
        v-if="icon"
        class="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-violet-600 text-white shadow-glow"
      >
        <component :is="icon" class="h-[22px] w-[22px]" :stroke-width="2" />
      </span>
      <div>
        <p v-if="eyebrow" class="eyebrow mb-1.5">{{ eyebrow }}</p>
        <h1 class="page-title">{{ title }}</h1>
        <p v-if="subtitle" class="mt-1.5 text-sm text-ink-500">{{ subtitle }}</p>
      </div>
    </div>
    <div class="flex shrink-0 items-center gap-2">
      <slot name="actions" />
    </div>
  </div>
</template>
