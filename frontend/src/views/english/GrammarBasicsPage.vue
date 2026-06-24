<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import PageHeader from '@/components/ui/PageHeader.vue'
import LoadingState from '@/components/ui/LoadingState.vue'
import GrammarLessonCard from '@/components/english/GrammarLessonCard.vue'
import { englishApi } from '@/api/english'
import { useEnglishStore } from '@/composables/useEnglishStore'
import type { GrammarLesson, PracticeQuestion } from '@/types/english'

const store = useEnglishStore()
const { t } = useI18n()
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
  <PageHeader eyebrow="AI English" :title="t('ec.grammar.title')" :subtitle="t('ec.grammar.subtitle')" />

  <LoadingState v-if="loading" :label="t('ec.grammar.loading')" />

  <div v-else class="space-y-4">
    <GrammarLessonCard
      v-for="(l, i) in lessons" :key="l.id" :lesson="l" :default-open="i === 0"
      @answered="onAnswered"
    />
  </div>
</template>
