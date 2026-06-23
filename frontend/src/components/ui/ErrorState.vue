<script setup lang="ts">
defineProps<{ message: string }>()
defineEmits<{ retry: [] }>()
</script>

<template>
  <div class="flex flex-col items-center justify-center gap-3 rounded-lg border border-red-100 bg-red-50 py-10 text-center">
    <svg class="h-8 w-8 text-red-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
    <p class="text-sm text-red-600">{{ message }}</p>
    <button class="btn-secondary" @click="$emit('retry')">Retry</button>
  </div>
</template>
