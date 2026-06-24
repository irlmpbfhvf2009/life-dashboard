<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Mic, ChevronLeft, ChevronRight } from 'lucide-vue-next'
import PageHeader from '@/components/ui/PageHeader.vue'
import LoadingState from '@/components/ui/LoadingState.vue'
import LearningStatCard from '@/components/english/LearningStatCard.vue'
import SpeakingPracticeCard from '@/components/english/SpeakingPracticeCard.vue'
import { englishApi } from '@/api/english'
import { useEnglishStore } from '@/composables/useEnglishStore'

const { t } = useI18n()
import type { SentenceComparison } from '@/utils/pronunciation'
import type { SpeakingPracticeItem } from '@/types/english'

const store = useEnglishStore()
const items = ref<SpeakingPracticeItem[]>([])
const loading = ref(true)
const idx = ref(0)

onMounted(async () => {
  items.value = await englishApi.getSpeakingItems()
  loading.value = false
})

const current = computed(() => items.value[idx.value])
const d = computed(() => store.data.value)

function onAttempt(_payload: { itemId: string; comparison: SentenceComparison }) {
  store.recordSpeaking(1)
  store.bumpMission('m-speak', 1)
}
function onAddReview(item: SpeakingPracticeItem) {
  store.addMistake({ category: 'speech', original: item.targetText, corrected: item.targetText, note: t('ec.speaking.title') })
}
function prev() { if (idx.value > 0) idx.value-- }
function next() { if (idx.value < items.value.length - 1) idx.value++ }
</script>

<template>
  <PageHeader eyebrow="AI English" :title="t('ec.speaking.title')" :subtitle="t('ec.speaking.subtitle')" />

  <LoadingState v-if="loading" :label="t('ec.speaking.loading')" />

  <template v-else>
    <div class="mb-6 grid gap-4 sm:grid-cols-3">
      <LearningStatCard :label="t('ec.speaking.today')" :value="t('ec.home.minutesN', { n: d?.speakingMinutes ?? 0 })" :sub="t('ec.speaking.accMinutes')" :icon="Mic" accent="text-rose-500 bg-rose-50" />
      <LearningStatCard :label="t('ec.speaking.attempts')" :value="d?.speechAttempts ?? 0" :sub="t('ec.speaking.totalShadow')" />
      <LearningStatCard :label="t('ec.speaking.progress')" :value="`${idx + 1} / ${items.length}`" :sub="t('ec.speaking.thisSet')" />
    </div>

    <div class="mb-3 flex items-center justify-between">
      <button class="btn-secondary btn-sm gap-1" :disabled="idx === 0" @click="prev"><ChevronLeft class="h-4 w-4" /> {{ t('ec.act.prevSentence') }}</button>
      <div class="flex gap-1">
        <span v-for="(_, i) in items" :key="i" class="h-1.5 w-6 rounded-full" :class="i === idx ? 'bg-brand-500' : 'bg-ink-200'" />
      </div>
      <button class="btn-secondary btn-sm gap-1" :disabled="idx === items.length - 1" @click="next">{{ t('ec.act.nextSentence') }} <ChevronRight class="h-4 w-4" /></button>
    </div>

    <SpeakingPracticeCard v-if="current" :item="current" @attempt="onAttempt" @add-review="onAddReview" />
  </template>
</template>
