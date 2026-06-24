<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
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

const scenarios = ref<EnglishScenario[]>([])
const loading = ref(true)

onMounted(async () => {
  scenarios.value = await englishApi.getScenarios()
  loading.value = false
})

const levelLabel: Record<string, string> = { BEGINNER: '初級', INTERMEDIATE: '中級', ADVANCED: '進階' }
const d = computed(() => store.data.value)
const completionPct = computed(() => {
  const m = store.mission.value
  return m && m.totalCount ? Math.round((m.completedCount / m.totalCount) * 100) : 0
})

const entries = [
  { to: '/ai/english/speaking', label: '口說練習', desc: '跟讀 + 即時相似度回饋', icon: Mic, accent: 'text-rose-500 bg-rose-50' },
  { to: '/ai/english/coach', label: '句子修正', desc: '貼上英文，AI 幫你改更自然', icon: PenLine, accent: 'text-brand-500 bg-brand-50' },
  { to: '/ai/english/review', label: '單字複習', desc: `${store.dueReviews.value.length} 項待複習`, icon: Repeat, accent: 'text-amber-500 bg-amber-50' },
]

const topMistakes = computed(() => store.mistakes.value.slice(0, 3))
</script>

<template>
  <PageHeader eyebrow="AI English" title="AI 英文教練" subtitle="用英文自然對話、跟讀練口說、被即時修正，每天一點一滴累積。">
    <template #actions>
      <button class="btn-secondary btn-sm gap-1.5" @click="router.push('/ai/english/placement')">
        <Sparkles class="h-3.5 w-3.5" /> 程度檢測
      </button>
      <button class="btn-primary btn-sm gap-1.5" @click="router.push('/ai/english/scenarios')">
        <GraduationCap class="h-3.5 w-3.5" /> 快速開始
      </button>
    </template>
  </PageHeader>

  <!-- Hero -->
  <div class="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
    <div class="card flex items-center gap-4 bg-gradient-to-br from-brand-500 to-indigo-600 p-5 text-white sm:col-span-2 lg:col-span-1">
      <ScoreRing :value="completionPct" :size="72" :stroke="7" suffix="%" />
      <div>
        <p class="text-sm font-medium text-white/80">今日進度</p>
        <p class="text-lg font-bold">{{ store.mission.value?.completedCount ?? 0 }} / {{ store.mission.value?.totalCount ?? 5 }} 任務</p>
      </div>
    </div>
    <LearningStatCard label="連續學習" :value="`${d?.streakDays ?? 0} 天`" sub="保持 streak" :icon="Flame" accent="text-orange-500 bg-orange-50" />
    <LearningStatCard label="本週練習" :value="`${d?.studyMinutes ?? 0} 分`" sub="學習時間" :icon="Clock" accent="text-sky-500 bg-sky-50" />
    <LearningStatCard label="目前程度" :value="levelLabel[store.level.value.level]" :sub="store.level.value.assessedAt ? '已檢測' : '尚未檢測'" :icon="GraduationCap" accent="text-brand-500 bg-brand-50" />
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
  <SectionCard :icon="GraduationCap" title="推薦情境練習" class="mb-6">
    <template #action>
      <button class="text-xs font-medium text-brand-600 hover:underline" @click="router.push('/ai/english/scenarios')">查看全部</button>
    </template>
    <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <ScenarioCard
        v-for="s in scenarios.slice(0, 3)" :key="s.id" :scenario="s"
        @start="router.push(`/ai/english/conversation/${s.id}`)"
      />
    </div>
  </SectionCard>

  <!-- Mistake summary -->
  <SectionCard :icon="AlertTriangle" title="常錯重點">
    <template #action>
      <button class="text-xs font-medium text-brand-600 hover:underline" @click="router.push('/ai/english/mistakes')">常錯庫</button>
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
      <p class="text-sm text-ink-400">還沒有常錯紀錄——開始一段對話或句子修正，錯誤會自動收集到這裡。</p>
    </div>
  </SectionCard>
</template>
