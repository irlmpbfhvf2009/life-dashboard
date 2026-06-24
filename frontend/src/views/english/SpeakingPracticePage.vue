<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Mic, ChevronLeft, ChevronRight } from 'lucide-vue-next'
import PageHeader from '@/components/ui/PageHeader.vue'
import LoadingState from '@/components/ui/LoadingState.vue'
import LearningStatCard from '@/components/english/LearningStatCard.vue'
import SpeakingPracticeCard from '@/components/english/SpeakingPracticeCard.vue'
import { englishApi } from '@/api/english'
import { useEnglishStore } from '@/composables/useEnglishStore'
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
  store.addMistake({ category: 'speech', original: item.targetText, corrected: item.targetText, note: '口說發音待加強' })
}
function prev() { if (idx.value > 0) idx.value-- }
function next() { if (idx.value < items.value.length - 1) idx.value++ }
</script>

<template>
  <PageHeader eyebrow="AI English · 口說" title="口說練習" subtitle="聽 AI 朗讀，按麥克風跟讀，系統即時比對你的發音內容並給回饋。" />

  <LoadingState v-if="loading" label="載入句子…" />

  <template v-else>
    <div class="mb-6 grid gap-4 sm:grid-cols-3">
      <LearningStatCard label="今日口說" :value="`${d?.speakingMinutes ?? 0} 分`" sub="累積練習時間" :icon="Mic" accent="text-rose-500 bg-rose-50" />
      <LearningStatCard label="語音嘗試" :value="d?.speechAttempts ?? 0" sub="總跟讀次數" />
      <LearningStatCard label="練習進度" :value="`${idx + 1} / ${items.length}`" sub="本組句子" />
    </div>

    <div class="mb-3 flex items-center justify-between">
      <button class="btn-secondary btn-sm gap-1" :disabled="idx === 0" @click="prev"><ChevronLeft class="h-4 w-4" /> 上一句</button>
      <div class="flex gap-1">
        <span v-for="(_, i) in items" :key="i" class="h-1.5 w-6 rounded-full" :class="i === idx ? 'bg-brand-500' : 'bg-ink-200'" />
      </div>
      <button class="btn-secondary btn-sm gap-1" :disabled="idx === items.length - 1" @click="next">下一句 <ChevronRight class="h-4 w-4" /></button>
    </div>

    <SpeakingPracticeCard v-if="current" :item="current" @attempt="onAttempt" @add-review="onAddReview" />
  </template>
</template>
