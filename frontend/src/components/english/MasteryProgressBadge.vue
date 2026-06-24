<script setup lang="ts">
import { computed } from 'vue'
import type { MasteryStatus } from '@/types/english'

const props = defineProps<{ status: MasteryStatus }>()

const map: Record<MasteryStatus, { label: string; cls: string }> = {
  NEW: { label: '新', cls: 'badge-gray' },
  LEARNING: { label: '學習中', cls: 'badge-brand' },
  REVIEWING: { label: '複習中', cls: 'badge-amber' },
  MASTERED: { label: '已掌握', cls: 'badge-green' },
}
const meta = computed(() => map[props.status])
</script>

<template>
  <span class="badge" :class="meta.cls">{{ meta.label }}</span>
</template>
