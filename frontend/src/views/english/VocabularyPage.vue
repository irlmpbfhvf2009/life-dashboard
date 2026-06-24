<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { ChevronLeft, ChevronRight, BookOpen, CheckCircle2 } from 'lucide-vue-next'
import PageHeader from '@/components/ui/PageHeader.vue'
import LoadingState from '@/components/ui/LoadingState.vue'
import LearningStatCard from '@/components/english/LearningStatCard.vue'
import VocabularyCard from '@/components/english/VocabularyCard.vue'
import { englishApi } from '@/api/english'
import { useEnglishStore } from '@/composables/useEnglishStore'
import type { ScenarioCategory, VocabularyItem } from '@/types/english'

const store = useEnglishStore()
const { t } = useI18n()
const all = ref<VocabularyItem[]>([])
const loading = ref(true)
const activeCat = ref<ScenarioCategory | 'all'>('all')
const idx = ref(0)

onMounted(async () => {
  all.value = await englishApi.getVocabulary()
  loading.value = false
})

const categories = computed(() => {
  const set = new Set(all.value.map((v) => v.scenario))
  return ['all', ...Array.from(set)] as (ScenarioCategory | 'all')[]
})
const items = computed(() =>
  activeCat.value === 'all' ? all.value : all.value.filter((v) => v.scenario === activeCat.value),
)
const current = computed(() => items.value[idx.value])

const masteredIds = computed(() => new Set(store.data.value?.masteredVocabIds ?? []))
const masteredCount = computed(() => all.value.filter((v) => masteredIds.value.has(v.id)).length)
const masteryPct = computed(() => (all.value.length ? Math.round((masteredCount.value / all.value.length) * 100) : 0))

function pickCat(c: ScenarioCategory | 'all') {
  activeCat.value = c
  idx.value = 0
}
function prev() { if (idx.value > 0) idx.value-- }
function next() { if (idx.value < items.value.length - 1) idx.value++ }

function onMaster(v: VocabularyItem) {
  store.masterVocab(v.id)
  if (idx.value < items.value.length - 1) setTimeout(next, 350)
}
function onAddReview(v: VocabularyItem) {
  store.queueReview('vocab', v.id, v.word)
}
</script>

<template>
  <PageHeader eyebrow="AI English" :title="t('ec.vocab.title')" :subtitle="t('ec.vocab.subtitle')" />

  <LoadingState v-if="loading" :label="t('ec.vocab.loading')" />

  <template v-else>
    <div class="mb-6 grid gap-4 sm:grid-cols-3">
      <LearningStatCard :label="t('ec.vocab.mastered')" :value="masteredCount" :sub="t('ec.vocab.totalWords', { n: all.length })" :icon="CheckCircle2" accent="text-emerald-500 bg-emerald-50" :ring="masteryPct" />
      <LearningStatCard :label="t('ec.vocab.currentCat')" :value="activeCat === 'all' ? t('ec.act.all') : t('ec.scat.' + activeCat)" :sub="t('ec.vocab.wordsN', { n: items.length })" :icon="BookOpen" />
      <LearningStatCard :label="t('ec.vocab.learnProgress')" :value="`${idx + 1} / ${items.length}`" :sub="t('ec.vocab.thisSet')" />
    </div>

    <!-- Category filter -->
    <div class="mb-5 flex flex-wrap gap-1.5">
      <button
        v-for="c in categories" :key="c"
        class="rounded-full border px-3 py-1 text-xs font-medium transition-colors"
        :class="activeCat === c ? 'border-brand-400 bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300' : 'border-ink-200 text-ink-500 hover:border-ink-300'"
        @click="pickCat(c)"
      >{{ c === 'all' ? t('ec.act.all') : t('ec.scat.' + c) }}</button>
    </div>

    <!-- Card flow -->
    <div class="mb-3 flex items-center justify-between">
      <button class="btn-secondary btn-sm gap-1" :disabled="idx === 0" @click="prev"><ChevronLeft class="h-4 w-4" /> {{ t('ec.act.prevCard') }}</button>
      <div class="flex gap-1">
        <span v-for="(_, i) in items" :key="i" class="h-1.5 w-5 rounded-full" :class="i === idx ? 'bg-brand-500' : 'bg-ink-200'" />
      </div>
      <button class="btn-secondary btn-sm gap-1" :disabled="idx >= items.length - 1" @click="next">{{ t('ec.act.nextCard') }} <ChevronRight class="h-4 w-4" /></button>
    </div>

    <VocabularyCard v-if="current" :item="current" :mastered="masteredIds.has(current.id)" @master="onMaster" @add-review="onAddReview" />
  </template>
</template>
