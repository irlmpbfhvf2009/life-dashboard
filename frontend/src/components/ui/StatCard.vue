<script setup lang="ts">
defineProps<{
  label: string
  value: string | number
  sub?: string
  accent?: 'brand' | 'green' | 'amber' | 'rose'
}>()
</script>

<template>
  <div class="card p-5">
    <p class="text-sm font-medium text-slate-500">{{ label }}</p>
    <p
      class="mt-2 text-3xl font-bold"
      :class="{
        'text-brand-600': accent === 'brand' || !accent,
        'text-emerald-600': accent === 'green',
        'text-amber-600': accent === 'amber',
        'text-rose-600': accent === 'rose',
      }"
    >
      {{ value }}
    </p>
    <p v-if="sub" class="mt-1 text-xs text-slate-400">{{ sub }}</p>
  </div>
</template>
