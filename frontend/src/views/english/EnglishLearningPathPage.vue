<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
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
const { t } = useI18n()
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

const levelLabel = (lvl: string) => t('ec.level.' + lvl)

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
    { unit: { id: 'u-vocab', title: t('ec.path.unitVocab'), type: 'vocab', status: status(vDone, vocab.value.length), itemCount: vocab.value.length }, progress: vocab.value.length ? Math.round(vDone / vocab.value.length * 100) : 0 },
    { unit: { id: 'u-phrase', title: t('ec.path.unitPhrase'), type: 'phrase', status: status(pDone, phrases.value.length), itemCount: phrases.value.length }, progress: phrases.value.length ? Math.round(pDone / phrases.value.length * 100) : 0 },
    { unit: { id: 'u-grammar', title: t('ec.path.unitGrammar'), type: 'grammar', status: 'LEARNING', itemCount: grammar.value.length }, progress: 0 },
    { unit: { id: 'u-scenario', title: t('ec.path.unitScenario'), type: 'scenario', status: status(sDone, scenarios.value.length), itemCount: scenarios.value.length }, progress: scenarios.value.length ? Math.round(sDone / scenarios.value.length * 100) : 0 },
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
  <PageHeader eyebrow="AI English" :title="t('ec.path.title')" :subtitle="t('ec.path.subtitle')" />

  <LoadingState v-if="loading" :label="t('ec.path.loading')" />

  <template v-else>
    <div class="mb-6 grid gap-4 sm:grid-cols-3">
      <div class="card flex items-center gap-4 bg-gradient-to-br from-brand-500 to-indigo-600 p-5 text-white">
        <ScoreRing :value="overallPct" :size="64" :stroke="7" suffix="%" />
        <div>
          <p class="text-sm font-medium text-white/80">{{ t('ec.path.overall') }}</p>
          <p class="text-lg font-bold">{{ levelLabel(store.level.value.level) }}</p>
        </div>
      </div>
      <LearningStatCard :label="t('ec.path.currentLevel')" :value="levelLabel(store.level.value.level)" :sub="store.level.value.assessedAt ? t('ec.path.assessed') : t('ec.path.notAssessed')" :icon="Route" accent="text-brand-500 bg-brand-50" />
      <LearningStatCard :label="t('ec.path.masteredSkills')" :value="masteredSkills.length" :sub="t('ec.path.ofUnits', { n: units.length })" :icon="Award" accent="text-emerald-500 bg-emerald-50" />
    </div>

    <SectionCard :icon="Route" :title="t('ec.path.units')" class="mb-6">
      <div class="space-y-3">
        <LearningPathCard
          v-for="row in units" :key="row.unit.id" :unit="row.unit" :progress="row.progress"
          :recommended="row.unit.id === nextUnitId"
        />
      </div>
    </SectionCard>

    <SectionCard v-if="masteredSkills.length" :icon="Award" :title="t('ec.path.masteredSkills')">
      <div class="flex flex-wrap gap-2">
        <span v-for="s in masteredSkills" :key="s" class="badge badge-green">{{ s }}</span>
      </div>
    </SectionCard>
    <div v-else class="card flex items-center gap-3 p-5 text-sm text-ink-500">
      <Sparkles class="h-5 w-5 text-brand-400" />
      {{ t('ec.path.skillsHint') }}
    </div>
  </template>
</template>
