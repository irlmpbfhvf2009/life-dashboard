<script setup lang="ts">
import { onMounted, ref } from 'vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import LoadingState from '@/components/ui/LoadingState.vue'
import GrammarLessonCard from '@/components/english/GrammarLessonCard.vue'
import { englishApi } from '@/api/english'
import { useEnglishStore } from '@/composables/useEnglishStore'
import type { GrammarLesson, PracticeQuestion } from '@/types/english'

const store = useEnglishStore()
const lessons = ref<GrammarLesson[]>([])
const loading = ref(true)

onMounted(async () => {
  lessons.value = await englishApi.getGrammar()
  loading.value = false
})

// Wrong answers become mistakes (logged + queued for review).
function onAnswered(payload: { question: PracticeQuestion; correct: boolean }) {
  if (payload.correct) return
  store.addMistake({
    category: 'grammar',
    original: payload.question.prompt,
    corrected: payload.question.answer,
    note: payload.question.explanationZh,
  })
}
</script>

<template>
  <PageHeader eyebrow="AI English · 基礎學習" title="基礎文法" subtitle="可行動的文法卡：正確 vs 中式英文對照、中文解析與互動練習；答錯自動收進常錯庫。" />

  <LoadingState v-if="loading" label="載入文法…" />

  <div v-else class="space-y-4">
    <GrammarLessonCard
      v-for="(l, i) in lessons" :key="l.id" :lesson="l" :default-open="i === 0"
      @answered="onAnswered"
    />
  </div>
</template>
