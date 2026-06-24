<script setup lang="ts">
import { computed, ref } from 'vue'
import { Sparkles, ClipboardCheck } from 'lucide-vue-next'
import PageHeader from '@/components/ui/PageHeader.vue'
import SectionCard from '@/components/ui/SectionCard.vue'
import PracticeQuestionCard from '@/components/english/PracticeQuestionCard.vue'
import PlacementResultCard from '@/components/english/PlacementResultCard.vue'
import { placementQuestions } from '@/data/english'
import { useEnglishStore } from '@/composables/useEnglishStore'
import type { EnglishLevel, PlacementResult } from '@/types/english'

const store = useEnglishStore()

const started = ref(false)
const answers = ref<Record<string, boolean>>({}) // questionId -> correct
const result = ref<PlacementResult | null>(null)

const answeredCount = computed(() => Object.keys(answers.value).length)
const allAnswered = computed(() => answeredCount.value >= placementQuestions.length)

function onAnswered(id: string, correct: boolean) {
  answers.value = { ...answers.value, [id]: correct }
}

function finish() {
  const correctCount = Object.values(answers.value).filter(Boolean).length
  const level: EnglishLevel = correctCount <= 2 ? 'BEGINNER' : correctCount <= 5 ? 'INTERMEDIATE' : 'ADVANCED'

  const weaknesses = placementQuestions
    .filter((q) => answers.value[q.id] === false)
    .map((q) => q.skill)
  const uniqueWeak = Array.from(new Set(weaknesses))

  const suggestedUnits = uniqueWeak.length
    ? uniqueWeak.map((w) => `${w} 練習`)
    : ['情境對話', '進階句型']

  const speakingFocus =
    level === 'BEGINNER'
      ? ['從短句跟讀開始', '熟悉日常問候與點餐']
      : level === 'INTERMEDIATE'
        ? ['練習情境對話的流暢度', '加強連音與語調']
        : ['挑戰商務與面試情境', '追求自然道地的表達']

  const r: PlacementResult = {
    estimatedLevel: level,
    recommendedPathId: level,
    weaknesses: uniqueWeak,
    suggestedUnits,
    speakingFocus,
  }
  result.value = r
  store.setLevel({ level, cefr: level === 'BEGINNER' ? 'A2' : level === 'INTERMEDIATE' ? 'B1' : 'C1', assessedAt: new Date().toISOString() })
}

function restart() {
  started.value = false
  answers.value = {}
  result.value = null
}
</script>

<template>
  <PageHeader eyebrow="AI English" title="程度檢測" subtitle="花兩分鐘做幾題，AI 幫你推估程度、找出弱點並推薦學習路徑。" />

  <!-- Result -->
  <div v-if="result">
    <PlacementResultCard :result="result" />
    <button class="btn-secondary btn-sm mt-4" @click="restart">重新檢測</button>
  </div>

  <!-- Intro -->
  <SectionCard v-else-if="!started">
    <div class="flex flex-col items-center gap-4 py-8 text-center">
      <div class="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-500 dark:bg-brand-500/10">
        <ClipboardCheck class="h-6 w-6" :stroke-width="1.75" />
      </div>
      <div>
        <p class="text-sm font-semibold text-ink-700">{{ placementQuestions.length }} 題快速檢測</p>
        <p class="mx-auto mt-1 max-w-sm text-xs text-ink-400">涵蓋時態、冠詞、介系詞、單字、句型與語感。完成後給你程度與建議。</p>
      </div>
      <button class="btn-primary btn-sm gap-1.5" @click="started = true">
        <Sparkles class="h-3.5 w-3.5" /> 開始檢測
      </button>
    </div>
  </SectionCard>

  <!-- Quiz -->
  <div v-else class="space-y-4">
    <div class="flex items-center justify-between">
      <p class="text-sm font-medium text-ink-500">已作答 {{ answeredCount }} / {{ placementQuestions.length }}</p>
      <div class="h-1.5 w-40 overflow-hidden rounded-full bg-ink-100">
        <div class="h-full rounded-full bg-brand-400 transition-all" :style="{ width: (answeredCount / placementQuestions.length * 100) + '%' }" />
      </div>
    </div>

    <PracticeQuestionCard
      v-for="q in placementQuestions" :key="q.id" :question="q"
      @answered="(correct) => onAnswered(q.id, correct)"
    />

    <button class="btn-primary w-full justify-center" :disabled="!allAnswered" @click="finish">
      {{ allAnswered ? '查看結果' : `還有 ${placementQuestions.length - answeredCount} 題` }}
    </button>
  </div>
</template>
