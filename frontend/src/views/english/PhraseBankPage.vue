<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
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
const all = ref<PhrasePattern[]>([])
const loading = ref(true)
const activeDiff = ref<Difficulty | 'all'>('all')

onMounted(async () => {
  all.value = await englishApi.getPhrases()
  loading.value = false
})

const DIFFS: { key: Difficulty | 'all'; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'BEGINNER', label: '初級' },
  { key: 'INTERMEDIATE', label: '中級' },
  { key: 'ADVANCED', label: '進階' },
]
const items = computed(() => (activeDiff.value === 'all' ? all.value : all.value.filter((p) => p.difficulty === activeDiff.value)))

const masteredIds = computed(() => new Set(store.data.value?.masteredPhraseIds ?? []))
const masteredCount = computed(() => all.value.filter((p) => masteredIds.value.has(p.id)).length)
const masteryPct = computed(() => (all.value.length ? Math.round((masteredCount.value / all.value.length) * 100) : 0))

function onMaster(p: PhrasePattern) { store.masterPhrase(p.id) }
function onAddReview(p: PhrasePattern) { store.queueReview('phrase', p.id, p.pattern) }
</script>

<template>
  <PageHeader eyebrow="AI English · 基礎學習" title="句型庫" subtitle="學常用句型：聽 AI 唸、看例句與常見錯誤，再用句型造句讓 AI 即時檢查。" />

  <LoadingState v-if="loading" label="載入句型…" />

  <template v-else>
    <div class="mb-6 grid gap-4 sm:grid-cols-2">
      <LearningStatCard label="已掌握句型" :value="masteredCount" :sub="`共 ${all.length} 個`" :icon="CheckCircle2" accent="text-emerald-500 bg-emerald-50" :ring="masteryPct" />
      <LearningStatCard label="本頁句型" :value="items.length" sub="可造句練習" :icon="MessageSquareQuote" />
    </div>

    <div class="mb-5 flex flex-wrap gap-1.5">
      <button
        v-for="d in DIFFS" :key="d.key"
        class="rounded-full border px-3 py-1 text-xs font-medium transition-colors"
        :class="activeDiff === d.key ? 'border-brand-400 bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300' : 'border-ink-200 text-ink-500 hover:border-ink-300'"
        @click="activeDiff = d.key"
      >{{ d.label }}</button>
    </div>

    <EmptyState v-if="!items.length" title="此難度暫無句型" description="換個難度看看。" />
    <div v-else class="grid gap-4 lg:grid-cols-2">
      <PhrasePatternCard
        v-for="p in items" :key="p.id" :pattern="p" :mastered="masteredIds.has(p.id)"
        @master="onMaster" @add-review="onAddReview"
      />
    </div>
  </template>
</template>
