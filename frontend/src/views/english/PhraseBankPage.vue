<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { MessageSquareQuote, CheckCircle2 } from 'lucide-vue-next'
import PageHeader from '@/components/ui/PageHeader.vue'
import LoadingState from '@/components/ui/LoadingState.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import LearningStatCard from '@/components/english/LearningStatCard.vue'
import PhrasePatternCard from '@/components/english/PhrasePatternCard.vue'
import { englishApi } from '@/api/english'
import { useEnglishStore } from '@/composables/useEnglishStore'
import type { Difficulty, PhrasePattern } from '@/types/english'

const store = useEnglishStore()
const { t } = useI18n()
const all = ref<PhrasePattern[]>([])
const loading = ref(true)
const activeDiff = ref<Difficulty | 'all'>('all')

onMounted(async () => {
  all.value = await englishApi.getPhrases()
  loading.value = false
})

const DIFFS: { key: Difficulty | 'all'; labelKey: string }[] = [
  { key: 'all', labelKey: 'ec.act.all' },
  { key: 'BEGINNER', labelKey: 'ec.difficulty.BEGINNER' },
  { key: 'INTERMEDIATE', labelKey: 'ec.difficulty.INTERMEDIATE' },
  { key: 'ADVANCED', labelKey: 'ec.difficulty.ADVANCED' },
]
const items = computed(() => (activeDiff.value === 'all' ? all.value : all.value.filter((p) => p.difficulty === activeDiff.value)))

const masteredIds = computed(() => new Set(store.data.value?.masteredPhraseIds ?? []))
const masteredCount = computed(() => all.value.filter((p) => masteredIds.value.has(p.id)).length)
const masteryPct = computed(() => (all.value.length ? Math.round((masteredCount.value / all.value.length) * 100) : 0))

function onMaster(p: PhrasePattern) { store.masterPhrase(p.id) }
function onAddReview(p: PhrasePattern) { store.queueReview('phrase', p.id, p.pattern) }
</script>

<template>
  <PageHeader eyebrow="AI English" :title="t('ec.phrase.title')" :subtitle="t('ec.phrase.subtitle')" />

  <LoadingState v-if="loading" :label="t('ec.phrase.loading')" />

  <template v-else>
    <div class="mb-6 grid gap-4 sm:grid-cols-2">
      <LearningStatCard :label="t('ec.phrase.mastered')" :value="masteredCount" :sub="t('ec.phrase.totalPatterns', { n: all.length })" :icon="CheckCircle2" accent="text-emerald-500 bg-emerald-50" :ring="masteryPct" />
      <LearningStatCard :label="t('ec.phrase.thisPage')" :value="items.length" :sub="t('ec.phrase.canCompose')" :icon="MessageSquareQuote" />
    </div>

    <div class="mb-5 flex flex-wrap gap-1.5">
      <button
        v-for="d in DIFFS" :key="d.key"
        class="rounded-full border px-3 py-1 text-xs font-medium transition-colors"
        :class="activeDiff === d.key ? 'border-brand-400 bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300' : 'border-ink-200 text-ink-500 hover:border-ink-300'"
        @click="activeDiff = d.key"
      >{{ t(d.labelKey) }}</button>
    </div>

    <EmptyState v-if="!items.length" :title="t('ec.phrase.emptyTitle')" :description="t('ec.phrase.emptyDesc')" />
    <div v-else class="grid gap-4 lg:grid-cols-2">
      <PhrasePatternCard
        v-for="p in items" :key="p.id" :pattern="p" :mastered="masteredIds.has(p.id)"
        @master="onMaster" @add-review="onAddReview"
      />
    </div>
  </template>
</template>
