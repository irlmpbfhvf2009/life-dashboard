<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { Flame, Clock, BookOpen, Repeat, Mic, PenLine, AlertTriangle, ChevronRight, Sparkles, GraduationCap } from 'lucide-vue-next'
import PageHeader from '@/components/ui/PageHeader.vue'
import SectionCard from '@/components/ui/SectionCard.vue'
import LearningStatCard from '@/components/english/LearningStatCard.vue'
import DailyMissionCard from '@/components/english/DailyMissionCard.vue'
import ScenarioCard from '@/components/english/ScenarioCard.vue'
import ScoreRing from '@/components/english/ScoreRing.vue'
import MasteryProgressBadge from '@/components/english/MasteryProgressBadge.vue'
import { englishApi } from '@/api/english'
import { useEnglishStore } from '@/composables/useEnglishStore'
import type { EnglishScenario } from '@/types/english'

const router = useRouter()
const store = useEnglishStore()
const { t } = useI18n()

const scenarios = ref<EnglishScenario[]>([])
const loading = ref(true)

onMounted(async () => {
  scenarios.value = await englishApi.getScenarios()
  loading.value = false
})

const d = computed(() => store.data.value)
const completionPct = computed(() => {
  const m = store.mission.value
  return m && m.totalCount ? Math.round((m.completedCount / m.totalCount) * 100) : 0
})

const entries = computed(() => [
  { to: '/ai/english/speaking', label: t('ec.nav.speakingPractice'), desc: t('ec.home.entrySpeakingDesc'), icon: Mic, accent: 'text-rose-500 bg-rose-50' },
  { to: '/ai/english/coach', label: t('ec.nav.coach'), desc: t('ec.home.entryCoachDesc'), icon: PenLine, accent: 'text-brand-500 bg-brand-50' },
  { to: '/ai/english/review', label: t('ec.nav.review'), desc: t('ec.home.entryReviewDesc', { n: store.dueReviews.value.length }), icon: Repeat, accent: 'text-amber-500 bg-amber-50' },
])

const topMistakes = computed(() => store.mistakes.value.slice(0, 3))
</script>

<template>
  <PageHeader eyebrow="AI English" :title="t('ec.home.title')" :subtitle="t('ec.home.subtitle')">
    <template #actions>
      <button class="btn-secondary btn-sm gap-1.5" @click="router.push('/ai/english/placement')">
        <Sparkles class="h-3.5 w-3.5" /> {{ t('ec.home.placement') }}
      </button>
      <button class="btn-primary btn-sm gap-1.5" @click="router.push('/ai/english/scenarios')">
        <GraduationCap class="h-3.5 w-3.5" /> {{ t('ec.home.quickStart') }}
      </button>
    </template>
  </PageHeader>

  <!-- Hero -->
  <div class="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
    <div class="card flex items-center gap-4 bg-gradient-to-br from-brand-500 to-indigo-600 p-5 text-white sm:col-span-2 lg:col-span-1">
      <ScoreRing :value="completionPct" :size="72" :stroke="7" suffix="%" />
      <div>
        <p class="text-sm font-medium text-white/80">{{ t('ec.home.todayProgress') }}</p>
        <p class="text-lg font-bold">{{ t('ec.home.tasksN', { done: store.mission.value?.completedCount ?? 0, total: store.mission.value?.totalCount ?? 5 }) }}</p>
      </div>
    </div>
    <LearningStatCard :label="t('ec.home.streak')" :value="t('ec.home.streakDays', { n: d?.streakDays ?? 0 })" :sub="t('ec.home.keepStreak')" :icon="Flame" accent="text-orange-500 bg-orange-50" />
    <LearningStatCard :label="t('ec.home.weekPractice')" :value="t('ec.home.minutesN', { n: d?.studyMinutes ?? 0 })" :sub="t('ec.home.studyTime')" :icon="Clock" accent="text-sky-500 bg-sky-50" />
    <LearningStatCard :label="t('ec.home.currentLevel')" :value="t('ec.level.' + store.level.value.level)" :sub="store.level.value.assessedAt ? t('ec.home.assessed') : t('ec.home.notAssessed')" :icon="GraduationCap" accent="text-brand-500 bg-brand-50" />
  </div>

  <!-- Mission + quick entries -->
  <div class="mb-6 grid gap-4 lg:grid-cols-3">
    <div class="lg:col-span-2">
      <DailyMissionCard v-if="store.mission.value" :mission="store.mission.value" />
    </div>
    <div class="space-y-3">
      <button
        v-for="e in entries" :key="e.to"
        class="card card-hover flex w-full items-center gap-3 p-4 text-left"
        @click="router.push(e.to)"
      >
        <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" :class="e.accent">
          <component :is="e.icon" class="h-5 w-5" />
        </div>
        <div class="min-w-0 flex-1">
          <p class="text-sm font-semibold text-ink-800">{{ e.label }}</p>
          <p class="truncate text-xs text-ink-400">{{ e.desc }}</p>
        </div>
        <ChevronRight class="h-4 w-4 shrink-0 text-ink-300" />
      </button>
    </div>
  </div>

  <!-- Recommended scenarios -->
  <SectionCard :icon="GraduationCap" :title="t('ec.home.recommendedScenarios')" class="mb-6">
    <template #action>
      <button class="text-xs font-medium text-brand-600 hover:underline" @click="router.push('/ai/english/scenarios')">{{ t('ec.act.viewAll') }}</button>
    </template>
    <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <ScenarioCard
        v-for="s in scenarios.slice(0, 3)" :key="s.id" :scenario="s"
        @start="router.push(`/ai/english/conversation/${s.id}`)"
      />
    </div>
  </SectionCard>

  <!-- Mistake summary -->
  <SectionCard :icon="AlertTriangle" :title="t('ec.home.mistakeFocus')">
    <template #action>
      <button class="text-xs font-medium text-brand-600 hover:underline" @click="router.push('/ai/english/mistakes')">{{ t('ec.home.mistakeLibrary') }}</button>
    </template>
    <ul v-if="topMistakes.length" class="divide-y divide-ink-100">
      <li v-for="m in topMistakes" :key="m.id" class="flex items-center gap-3 py-2.5">
        <div class="min-w-0 flex-1">
          <p class="truncate text-sm text-ink-500 line-through decoration-rose-300">{{ m.original }}</p>
          <p class="truncate text-sm font-medium text-ink-800">{{ m.corrected }}</p>
        </div>
        <span class="shrink-0 text-xs text-ink-400">× {{ m.frequency }}</span>
        <MasteryProgressBadge :status="m.mastery" />
      </li>
    </ul>
    <div v-else class="flex flex-col items-center gap-2 py-8 text-center">
      <BookOpen class="h-6 w-6 text-ink-300" />
      <p class="text-sm text-ink-400">{{ t('ec.home.noMistakes') }}</p>
    </div>
  </SectionCard>
</template>
