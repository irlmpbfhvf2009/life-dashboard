<script setup lang="ts">
withDefaults(defineProps<{ title?: string; description?: string }>(), {
  title: 'Nothing here yet',
  description: 'Add your first entry to get started.',
})
</script>

<template>
  <div class="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-slate-200 py-12 text-center">
    <svg class="h-10 w-10 text-slate-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M3 9h18M9 21V9" />
    </svg>
    <p class="text-sm font-medium text-slate-600">{{ title }}</p>
    <p class="max-w-xs text-xs text-slate-400">{{ description }}</p>
    <slot />
  </div>
</template>
