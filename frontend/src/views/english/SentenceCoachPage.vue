<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { PenLine, Wand2, BookmarkPlus, Check } from 'lucide-vue-next'
import PageHeader from '@/components/ui/PageHeader.vue'
import SectionCard from '@/components/ui/SectionCard.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import CorrectionCard from '@/components/english/CorrectionCard.vue'
import { englishApi } from '@/api/english'
import { useEnglishStore } from '@/composables/useEnglishStore'
import type { EnglishCorrection } from '@/types/english'

const store = useEnglishStore()
const { t } = useI18n()
const input = ref('')
const loading = ref(false)
const result = ref<EnglishCorrection | null>(null)
const added = ref(false)
const error = ref('')

const samples = [
  'I very like this movie.',
  'Yesterday I go to the park with my friend.',
  'He don’t have any money.',
]

async function correct(text?: string) {
  const sentence = (text ?? input.value).trim()
  if (!sentence || loading.value) return
  if (text) input.value = text
  loading.value = true
  error.value = ''
  added.value = false
  try {
    result.value = await englishApi.correctSentence(sentence)
    store.bumpMission('m-correct', 1)
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    loading.value = false
  }
}

function addReview() {
  if (!result.value) return
  store.addMistake({
    category: 'grammar',
    original: result.value.original,
    corrected: result.value.corrected,
    note: result.value.explanationZh,
  })
  added.value = true
}
</script>

<template>
  <PageHeader eyebrow="AI English" :title="t('ec.coach.title')" :subtitle="t('ec.coach.subtitle')" />

  <div class="grid gap-4 lg:grid-cols-2">
    <!-- Input -->
    <SectionCard :icon="PenLine" :title="t('ec.coach.yourSentence')">
      <textarea
        v-model="input" rows="5"
        :placeholder="t('ec.coach.placeholder')"
        class="w-full resize-none rounded-xl border border-ink-200 bg-surface p-3 text-sm leading-relaxed text-ink-800 outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
        @keydown.ctrl.enter="correct()" @keydown.meta.enter="correct()"
      />
      <div class="mt-3 flex items-center justify-between">
        <div class="flex flex-wrap gap-1.5">
          <button v-for="s in samples" :key="s" class="rounded-full border border-ink-200 px-2.5 py-1 text-xs text-ink-500 transition-colors hover:border-brand-300 hover:text-brand-600" @click="correct(s)">{{ s }}</button>
        </div>
        <button class="btn-primary btn-sm gap-1.5" :disabled="loading || !input.trim()" @click="correct()">
          <Wand2 class="h-3.5 w-3.5" /> {{ loading ? t('ec.coach.fixing') : t('ec.coach.aiFix') }}
        </button>
      </div>
      <p v-if="error" class="mt-2 text-sm text-rose-600">{{ error }}</p>
    </SectionCard>

    <!-- Result -->
    <SectionCard :icon="Wand2" :title="t('ec.coach.result')">
      <EmptyState v-if="!result && !loading" :icon="PenLine" :title="t('ec.coach.noResult')" :description="t('ec.coach.noResultDesc')" />
      <div v-else-if="loading" class="flex items-center gap-2 py-8 text-sm text-ink-400">
        <span class="h-1.5 w-1.5 animate-bounce rounded-full bg-ink-400" />
        <span class="h-1.5 w-1.5 animate-bounce rounded-full bg-ink-400" style="animation-delay:150ms" />
        <span class="h-1.5 w-1.5 animate-bounce rounded-full bg-ink-400" style="animation-delay:300ms" /> {{ t('ec.coach.analyzing') }}
      </div>
      <div v-else-if="result">
        <CorrectionCard :correction="result" />
        <button class="btn-secondary btn-sm mt-4 w-full justify-center gap-1.5" :disabled="added" @click="addReview">
          <Check v-if="added" class="h-3.5 w-3.5 text-emerald-500" />
          <BookmarkPlus v-else class="h-3.5 w-3.5" />
          {{ added ? t('ec.act.added') : t('ec.coach.addReview') }}
        </button>
      </div>
    </SectionCard>
  </div>
</template>
