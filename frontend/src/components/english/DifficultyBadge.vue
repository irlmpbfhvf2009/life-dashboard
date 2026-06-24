<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { Difficulty } from '@/types/english'

const props = defineProps<{ level: Difficulty }>()
const { t } = useI18n()

const CLS: Record<Difficulty, string> = {
  BEGINNER: 'badge-green',
  INTERMEDIATE: 'badge-amber',
  ADVANCED: 'badge-rose',
}
const cls = computed(() => CLS[props.level])
</script>

<template>
  <span class="badge" :class="cls">{{ t('ec.difficulty.' + level) }}</span>
</template>
