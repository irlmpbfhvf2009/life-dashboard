<script setup lang="ts">
import { computed } from 'vue'
import type { Difficulty } from '@/types/english'

const props = defineProps<{ level: Difficulty }>()

const map: Record<Difficulty, { label: string; cls: string }> = {
  BEGINNER: { label: '初級', cls: 'badge-green' },
  INTERMEDIATE: { label: '中級', cls: 'badge-amber' },
  ADVANCED: { label: '進階', cls: 'badge-rose' },
}
const meta = computed(() => map[props.level])
</script>

<template>
  <span class="badge" :class="meta.cls">{{ meta.label }}</span>
</template>
