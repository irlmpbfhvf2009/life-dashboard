<script setup lang="ts">
import { Loader2 } from 'lucide-vue-next'
withDefaults(defineProps<{ label?: string }>(), { label: '載入中…' })
</script>

<template>
  <div class="flex flex-col items-center justify-center gap-3 py-16 text-ink-400">
    <Loader2 class="h-7 w-7 animate-spin text-brand-500" :stroke-width="2" />
    <span class="text-sm">{{ label }}</span>
  </div>
</template>
