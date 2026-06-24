<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { MasteryStatus } from '@/types/english'

const props = defineProps<{ status: MasteryStatus }>()
const { t } = useI18n()

const CLS: Record<MasteryStatus, string> = {
  NEW: 'badge-gray',
  LEARNING: 'badge-brand',
  REVIEWING: 'badge-amber',
  MASTERED: 'badge-green',
}
const cls = computed(() => CLS[props.status])
</script>

<template>
  <span class="badge" :class="cls">{{ t('ec.mastery.' + status) }}</span>
</template>
