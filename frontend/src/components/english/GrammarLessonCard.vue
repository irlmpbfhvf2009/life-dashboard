<script setup lang="ts">
import { ref } from 'vue'
import { ChevronDown, Check, X, GraduationCap } from 'lucide-vue-next'
import AudioPlayButton from './AudioPlayButton.vue'
import PracticeQuestionCard from './PracticeQuestionCard.vue'
import type { GrammarLesson, PracticeQuestion } from '@/types/english'

const props = defineProps<{ lesson: GrammarLesson; defaultOpen?: boolean }>()
const emit = defineEmits<{ answered: [payload: { question: PracticeQuestion; correct: boolean }] }>()

const open = ref(!!props.defaultOpen)
</script>

<template>
  <div class="card overflow-hidden p-0">
    <!-- Header -->
    <button class="flex w-full items-center gap-3 p-5 text-left" @click="open = !open">
      <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-500 dark:bg-brand-500/10">
        <GraduationCap class="h-4.5 w-4.5" :stroke-width="2" />
      </div>
      <div class="min-w-0 flex-1">
        <h3 class="font-bold text-ink-900">{{ lesson.topic }}</h3>
        <p class="truncate text-sm text-ink-500">{{ lesson.summaryZh }}</p>
      </div>
      <ChevronDown class="h-5 w-5 shrink-0 text-ink-400 transition-transform" :class="open && 'rotate-180'" />
    </button>

    <!-- Body -->
    <div v-if="open" class="space-y-5 border-t border-ink-100 p-5">
      <!-- Examples -->
      <div class="grid gap-4 sm:grid-cols-2">
        <div>
          <p class="mb-2 flex items-center gap-1.5 text-xs font-semibold text-emerald-600"><Check class="h-3.5 w-3.5" /> 正確</p>
          <ul class="space-y-1.5">
            <li v-for="ex in lesson.correctExamples" :key="ex" class="flex items-center justify-between gap-2 rounded-lg bg-emerald-50 px-2.5 py-1.5 text-xs text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
              <span>{{ ex }}</span><AudioPlayButton :text="ex" />
            </li>
          </ul>
        </div>
        <div>
          <p class="mb-2 flex items-center gap-1.5 text-xs font-semibold text-rose-600"><X class="h-3.5 w-3.5" /> 錯誤</p>
          <ul class="space-y-1.5">
            <li v-for="ex in lesson.wrongExamples" :key="ex" class="rounded-lg bg-rose-50 px-2.5 py-1.5 text-xs text-rose-700 line-through decoration-rose-300 dark:bg-rose-500/10 dark:text-rose-300">{{ ex }}</li>
          </ul>
        </div>
      </div>

      <!-- Explanation -->
      <p class="rounded-xl bg-ink-50 px-3.5 py-3 text-sm leading-relaxed text-ink-600">{{ lesson.explanationZh }}</p>

      <!-- Practice -->
      <div v-if="lesson.questions.length" class="space-y-3">
        <p class="text-sm font-semibold text-ink-700">小練習</p>
        <PracticeQuestionCard
          v-for="q in lesson.questions" :key="q.id" :question="q"
          @answered="(correct) => emit('answered', { question: q, correct })"
        />
      </div>
    </div>
  </div>
</template>
