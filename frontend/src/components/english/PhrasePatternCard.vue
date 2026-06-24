<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { AlertTriangle, Wand2, Check, BookmarkPlus, Sparkles } from 'lucide-vue-next'
import AudioPlayButton from './AudioPlayButton.vue'
import DifficultyBadge from './DifficultyBadge.vue'
import MasteryProgressBadge from './MasteryProgressBadge.vue'
import { englishApi } from '@/api/english'
import type { EnglishCorrection, PhrasePattern } from '@/types/english'

defineProps<{ pattern: PhrasePattern; mastered?: boolean }>()
const emit = defineEmits<{ master: [pattern: PhrasePattern]; addReview: [pattern: PhrasePattern] }>()
const { t } = useI18n()

const draft = ref('')
const checking = ref(false)
const result = ref<EnglishCorrection | null>(null)

async function check() {
  if (!draft.value.trim() || checking.value) return
  checking.value = true
  result.value = null
  try {
    result.value = await englishApi.correctSentence(draft.value.trim())
  } finally {
    checking.value = false
  }
}
</script>

<template>
  <div class="card p-6">
    <div class="mb-3 flex items-center justify-between">
      <span class="text-xs font-medium text-brand-600">{{ t('ec.scat.' + pattern.scenario) }}</span>
      <div class="flex items-center gap-1.5">
        <DifficultyBadge :level="pattern.difficulty" />
        <MasteryProgressBadge :status="mastered ? 'MASTERED' : 'NEW'" />
      </div>
    </div>

    <!-- Pattern -->
    <div class="flex items-start justify-between gap-2">
      <div>
        <h2 class="text-xl font-bold text-ink-900">{{ pattern.pattern }}</h2>
        <p class="mt-0.5 text-sm text-ink-500">{{ pattern.meaningZh }}</p>
      </div>
      <AudioPlayButton :text="pattern.pattern" slow size="md" />
    </div>

    <!-- Examples -->
    <div class="mt-4 space-y-2">
      <p class="text-xs font-semibold text-ink-500">{{ t('ec.phrase.examples') }}</p>
      <div v-for="ex in pattern.examples" :key="ex" class="flex items-center justify-between gap-2 rounded-xl bg-ink-50 px-3 py-2">
        <span class="text-sm text-ink-700">{{ ex }}</span>
        <AudioPlayButton :text="ex" slow />
      </div>
    </div>

    <!-- Common mistakes -->
    <div v-if="pattern.commonMistakes.length" class="mt-4">
      <p class="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-amber-600"><AlertTriangle class="h-3.5 w-3.5" /> {{ t('ec.phrase.commonMistakes') }}</p>
      <ul class="space-y-1">
        <li v-for="m in pattern.commonMistakes" :key="m" class="rounded-lg bg-amber-50 px-2.5 py-1.5 text-xs text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">{{ m }}</li>
      </ul>
    </div>

    <!-- Compose practice -->
    <div class="mt-5 border-t border-ink-100 pt-4">
      <p class="mb-2 text-sm font-medium text-ink-700">{{ pattern.practicePrompt }}</p>
      <div class="flex gap-2">
        <input v-model="draft" type="text" class="input flex-1" :placeholder="t('ec.phrase.composeHint')" @keydown.enter="check" />
        <button class="btn-primary btn-sm gap-1.5" :disabled="checking || !draft.trim()" @click="check">
          <Wand2 class="h-3.5 w-3.5" /> {{ checking ? t('ec.phrase.checking') : t('ec.phrase.aiCheck') }}
        </button>
      </div>

      <div v-if="result" class="mt-3 space-y-2 rounded-xl bg-ink-50 p-3">
        <div class="flex items-start justify-between gap-2">
          <p class="text-sm font-semibold text-ink-900">{{ result.corrected }}</p>
          <AudioPlayButton :text="result.corrected" slow />
        </div>
        <p v-if="result.natural && result.natural !== result.corrected" class="flex items-center gap-1 text-xs text-brand-600">
          <Sparkles class="h-3.5 w-3.5" /> {{ result.natural }}
        </p>
        <p v-if="result.explanationZh" class="text-xs text-ink-500">{{ result.explanationZh }}</p>
      </div>
    </div>

    <!-- Actions -->
    <div class="mt-4 flex gap-2">
      <button class="btn-primary btn-sm flex-1 justify-center gap-1.5" :disabled="mastered" @click="emit('master', pattern)">
        <Check class="h-3.5 w-3.5" /> {{ mastered ? t('ec.act.mastered') : t('ec.act.iKnow') }}
      </button>
      <button class="btn-secondary btn-sm flex-1 justify-center gap-1.5" @click="emit('addReview', pattern)">
        <BookmarkPlus class="h-3.5 w-3.5" /> {{ t('ec.act.addReview') }}
      </button>
    </div>
  </div>
</template>
