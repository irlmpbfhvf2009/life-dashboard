<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { AlertTriangle } from 'lucide-vue-next'
import PageHeader from '@/components/ui/PageHeader.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import LearningStatCard from '@/components/english/LearningStatCard.vue'
import MistakeCard from '@/components/english/MistakeCard.vue'
import { useEnglishStore } from '@/composables/useEnglishStore'
import type { EnglishMistake, MistakeCategory } from '@/types/english'

const store = useEnglishStore()
const { t } = useI18n()
const activeCat = ref<MistakeCategory | 'all'>('all')

const mistakes = computed(() => store.mistakes.value)
const categories = computed(() => {
  const set = new Set(mistakes.value.map((m) => m.category))
  return ['all', ...Array.from(set)] as (MistakeCategory | 'all')[]
})
const filtered = computed(() =>
  activeCat.value === 'all' ? mistakes.value : mistakes.value.filter((m) => m.category === activeCat.value),
)
const masteredCount = computed(() => mistakes.value.filter((m) => m.mastery === 'MASTERED').length)

const queuedRefIds = computed(() => new Set(store.reviews.value.filter((r) => r.refType === 'mistake').map((r) => r.refId)))

function review(m: EnglishMistake) {
  store.queueReview('mistake', m.id, m.original)
}
</script>

<template>
  <PageHeader eyebrow="AI English" :title="t('ec.mistakes.title')" :subtitle="t('ec.mistakes.subtitle')" />

  <div class="mb-6 grid gap-4 sm:grid-cols-3">
    <LearningStatCard :label="t('ec.mistakes.total')" :value="mistakes.length" :sub="t('ec.mistakes.accCollected')" :icon="AlertTriangle" accent="text-amber-500 bg-amber-50" />
    <LearningStatCard :label="t('ec.mistakes.masteredN')" :value="masteredCount" :sub="t('ec.mistakes.ofN', { n: mistakes.length })" />
    <LearningStatCard :label="t('ec.mistakes.queue')" :value="queuedRefIds.size" :sub="t('ec.mistakes.queueSub')" />
  </div>

  <EmptyState
    v-if="!mistakes.length"
    :icon="AlertTriangle"
    :title="t('ec.mistakes.emptyTitle')"
    :description="t('ec.mistakes.emptyDesc')"
  />

  <template v-else>
    <div class="mb-5 flex flex-wrap gap-1.5">
      <button
        v-for="c in categories" :key="c"
        class="rounded-full border px-3 py-1 text-xs font-medium transition-colors"
        :class="activeCat === c ? 'border-brand-400 bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300' : 'border-ink-200 text-ink-500 hover:border-ink-300'"
        @click="activeCat = c"
      >{{ c === 'all' ? t('ec.act.all') : t('ec.mcat.' + c) }}</button>
    </div>

    <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <MistakeCard
        v-for="m in filtered" :key="m.id" :mistake="m" :queued="queuedRefIds.has(m.id)"
        @review="review"
      />
    </div>
  </template>
</template>
