<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import ScoreRing from './ScoreRing.vue'
import type { PronunciationFeedback } from '@/types/english'

defineProps<{ feedback: PronunciationFeedback }>()
const { t } = useI18n()

const bars = (f: PronunciationFeedback) => [
  { label: t('ec.speaking.fluency'), value: f.fluency },
  { label: t('ec.speaking.completeness'), value: f.completeness },
]
</script>

<template>
  <div class="flex flex-col items-center gap-5 sm:flex-row sm:items-center">
    <ScoreRing :value="feedback.similarityScore" :size="112" :stroke="9" :label="t('ec.speaking.similarity')" suffix="%" />
    <div class="w-full flex-1 space-y-3">
      <div v-for="b in bars(feedback)" :key="b.label">
        <div class="mb-1 flex items-center justify-between text-xs">
          <span class="text-ink-500">{{ b.label }}</span>
          <span class="font-semibold text-ink-700">{{ Math.round(b.value) }}%</span>
        </div>
        <div class="h-2 overflow-hidden rounded-full bg-ink-100">
          <div class="h-full rounded-full bg-brand-400 transition-all" :style="{ width: b.value + '%' }" />
        </div>
      </div>
      <p class="rounded-xl bg-ink-50 px-3 py-2 text-sm text-ink-600">{{ feedback.message }}</p>
    </div>
  </div>
</template>
