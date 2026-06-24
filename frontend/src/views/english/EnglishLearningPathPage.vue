<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Route, Award, Sparkles } from 'lucide-vue-next'
import PageHeader from '@/components/ui/PageHeader.vue'
import SectionCard from '@/components/ui/SectionCard.vue'
import LoadingState from '@/components/ui/LoadingState.vue'
import LearningStatCard from '@/components/english/LearningStatCard.vue'
import LearningPathCard from '@/components/english/LearningPathCard.vue'
import ScoreRing from '@/components/english/ScoreRing.vue'
import { englishApi } from '@/api/english'
import { useEnglishStore } from '@/composables/useEnglishStore'
import type { LearningUnit, MasteryStatus, VocabularyItem, PhrasePattern, GrammarLesson, EnglishScenario } from '@/types/english'

const store = useEnglishStore()
const loading = ref(true)
const vocab = ref<VocabularyItem[]>([])
const phrases = ref<PhrasePattern[]>([])
const grammar = ref<GrammarLesson[]>([])
const scenarios = ref<EnglishScenario[]>([])

onMounted(async () => {
  ;[vocab.value, phrases.value, grammar.value, scenarios.value] = await Promise.all([
    englishApi.getVocabulary(), englishApi.getPhrases(), englishApi.getGrammar(), englishApi.getScenarios(),
  ])
  loading.value = false
})

const LEVEL_LABEL: Record<string, string> = { BEGINNER: '初級', INTERMEDIATE: '中級', ADVANCED: '進階' }

function status(done: number, total: number): MasteryStatus {
  if (total === 0 || done === 0) return 'NEW'
  if (done >= total) return 'MASTERED'
  return done >= total / 2 ? 'REVIEWING' : 'LEARNING'
}

const d = computed(() => store.data.value)

const units = computed<{ unit: LearningUnit; progress: number }[]>(() => {
  const mv = new Set(d.value?.masteredVocabIds ?? [])
  const mp = new Set(d.value?.masteredPhraseIds ?? [])
  const sc = new Set(d.value?.completedScenarioIds ?? [])
  const vDone = vocab.value.filter((v) => mv.has(v.id)).length
  const pDone = phrases.value.filter((p) => mp.has(p.id)).length
  const sDone = scenarios.value.filter((s) => sc.has(s.id)).length
  const rows: { unit: LearningUnit; progress: number }[] = [
    { unit: { id: 'u-vocab', title: '核心單字', type: 'vocab', status: status(vDone, vocab.value.length), itemCount: vocab.value.length }, progress: vocab.value.length ? Math.round(vDone / vocab.value.length * 100) : 0 },
    { unit: { id: 'u-phrase', title: '常用句型', type: 'phrase', status: status(pDone, phrases.value.length), itemCount: phrases.value.length }, progress: phrases.value.length ? Math.round(pDone / phrases.value.length * 100) : 0 },
    { unit: { id: 'u-grammar', title: '基礎文法', type: 'grammar', status: 'LEARNING', itemCount: grammar.value.length }, progress: 0 },
    { unit: { id: 'u-scenario', title: '情境對話', type: 'scenario', status: status(sDone, scenarios.value.length), itemCount: scenarios.value.length }, progress: scenarios.value.length ? Math.round(sDone / scenarios.value.length * 100) : 0 },
  ]
  return rows
})

const overallPct = computed(() => {
  if (!units.value.length) return 0
  return Math.round(units.value.reduce((s, u) => s + u.progress, 0) / units.value.length)
})
const nextUnitId = computed(() => units.value.find((u) => u.unit.status !== 'MASTERED')?.unit.id)
const masteredSkills = computed(() =>
  units.value.filter((u) => u.unit.status === 'MASTERED').map((u) => u.unit.title),
)
</script>

<template>
  <PageHeader eyebrow="AI English" title="學習路徑" subtitle="依你的程度與掌握進度，安排單字、句型、文法與情境的學習順序。" />

  <LoadingState v-if="loading" label="整理你的學習路徑…" />

  <template v-else>
    <div class="mb-6 grid gap-4 sm:grid-cols-3">
      <div class="card flex items-center gap-4 bg-gradient-to-br from-brand-500 to-indigo-600 p-5 text-white">
        <ScoreRing :value="overallPct" :size="64" :stroke="7" suffix="%" />
        <div>
          <p class="text-sm font-medium text-white/80">整體進度</p>
          <p class="text-lg font-bold">{{ LEVEL_LABEL[store.level.value.level] }}</p>
        </div>
      </div>
      <LearningStatCard label="目前程度" :value="LEVEL_LABEL[store.level.value.level]" :sub="store.level.value.assessedAt ? '已檢測' : '尚未檢測'" :icon="Route" accent="text-brand-500 bg-brand-50" />
      <LearningStatCard label="已掌握技能" :value="masteredSkills.length" :sub="`共 ${units.length} 單元`" :icon="Award" accent="text-emerald-500 bg-emerald-50" />
    </div>

    <SectionCard :icon="Route" title="學習單元" class="mb-6">
      <div class="space-y-3">
        <LearningPathCard
          v-for="row in units" :key="row.unit.id" :unit="row.unit" :progress="row.progress"
          :recommended="row.unit.id === nextUnitId"
        />
      </div>
    </SectionCard>

    <SectionCard v-if="masteredSkills.length" :icon="Award" title="已掌握技能">
      <div class="flex flex-wrap gap-2">
        <span v-for="s in masteredSkills" :key="s" class="badge badge-green">{{ s }}</span>
      </div>
    </SectionCard>
    <div v-else class="card flex items-center gap-3 p-5 text-sm text-ink-500">
      <Sparkles class="h-5 w-5 text-brand-400" />
      完成上面的單元（在單字/句型頁標記「我會了」、在情境完成對話）就會解鎖技能。
    </div>
  </template>
</template>
