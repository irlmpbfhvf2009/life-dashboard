<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Check, X, Lightbulb } from 'lucide-vue-next'
import AudioPlayButton from './AudioPlayButton.vue'
import type { PracticeQuestion } from '@/types/english'

const props = defineProps<{ question: PracticeQuestion }>()
const emit = defineEmits<{ answered: [correct: boolean] }>()
const { t } = useI18n()

const selected = ref<string | null>(null)
const typed = ref('')
const submitted = ref(false)

function normalize(s: string) {
  return s.trim().toLowerCase().replace(/[.!?,]/g, '')
}

const correct = computed(() => {
  if (!submitted.value) return false
  if (props.question.kind === 'choice') return selected.value === props.question.answer
  // cloze / compose: accept if the answer text appears (compose is lenient).
  return normalize(typed.value).includes(normalize(props.question.answer))
})

function choose(opt: string) {
  if (submitted.value) return
  selected.value = opt
  submitted.value = true
  emit('answered', opt === props.question.answer)
}
function submit() {
  if (submitted.value || !typed.value.trim()) return
  submitted.value = true
  emit('answered', correct.value)
}
function reset() {
  selected.value = null
  typed.value = ''
  submitted.value = false
}
</script>

<template>
  <div class="rounded-2xl border border-ink-100 p-4">
    <p class="mb-3 text-sm font-medium text-ink-800">{{ question.prompt }}</p>

    <!-- Choice -->
    <div v-if="question.kind === 'choice'" class="space-y-2">
      <button
        v-for="opt in question.options" :key="opt"
        class="flex w-full items-center justify-between rounded-xl border px-3 py-2 text-left text-sm transition-colors"
        :class="[
          submitted && opt === question.answer ? 'border-emerald-400 bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10' : '',
          submitted && opt === selected && opt !== question.answer ? 'border-rose-400 bg-rose-50 text-rose-700 dark:bg-rose-500/10' : '',
          !submitted ? 'border-ink-200 text-ink-700 hover:border-brand-300' : 'border-ink-200',
        ]"
        :disabled="submitted"
        @click="choose(opt)"
      >
        {{ opt }}
        <Check v-if="submitted && opt === question.answer" class="h-4 w-4 text-emerald-500" />
        <X v-else-if="submitted && opt === selected" class="h-4 w-4 text-rose-500" />
      </button>
    </div>

    <!-- Cloze / Compose -->
    <div v-else class="flex gap-2">
      <input
        v-model="typed" type="text"
        :placeholder="question.kind === 'compose' ? t('ec.grammar.composePlaceholder') : t('ec.grammar.clozePlaceholder')"
        class="input flex-1" :disabled="submitted"
        @keydown.enter="submit"
      />
      <button v-if="!submitted" class="btn-primary btn-sm" :disabled="!typed.trim()" @click="submit">{{ t('ec.act.submit') }}</button>
    </div>

    <!-- Feedback -->
    <div v-if="submitted" class="mt-3 space-y-2">
      <div
        class="flex items-center gap-1.5 text-sm font-semibold"
        :class="correct ? 'text-emerald-600' : 'text-amber-600'"
      >
        <Check v-if="correct" class="h-4 w-4" /><X v-else class="h-4 w-4" />
        {{ correct ? t('ec.grammar.qRight') : (question.kind === 'compose' ? t('ec.grammar.qSubmitted') : t('ec.grammar.qWrong')) }}
      </div>
      <div class="flex items-start gap-2 rounded-xl bg-ink-50 px-3 py-2 text-xs text-ink-600">
        <Lightbulb class="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
        <div class="flex-1">
          <p><span class="font-medium text-ink-700">{{ t('ec.grammar.qReference') }}</span>{{ question.answer }}
            <AudioPlayButton :text="question.answer" class="ml-1 align-middle" /></p>
          <p class="mt-1">{{ question.explanationZh }}</p>
        </div>
      </div>
      <button class="text-xs text-brand-600 hover:underline" @click="reset">{{ t('ec.act.retry') }}</button>
    </div>
  </div>
</template>
