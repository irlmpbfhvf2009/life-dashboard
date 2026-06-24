<script setup lang="ts">
import { computed } from 'vue'
import { Doughnut } from 'vue-chartjs'
import type { ChartData, ChartOptions } from 'chart.js'
import '@/components/charts/registerCharts'
import { Flame, Clock, Mic, BookOpen, MessageSquareQuote, GraduationCap, Layers, AlertTriangle } from 'lucide-vue-next'
import PageHeader from '@/components/ui/PageHeader.vue'
import SectionCard from '@/components/ui/SectionCard.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import LearningStatCard from '@/components/english/LearningStatCard.vue'
import { MISTAKE_LABELS } from '@/data/english'
import { useEnglishStore } from '@/composables/useEnglishStore'
import type { MistakeCategory } from '@/types/english'

const store = useEnglishStore()
const d = computed(() => store.data.value)

const masteredVocab = computed(() => d.value?.masteredVocabIds.length ?? 0)
const masteredPhrases = computed(() => d.value?.masteredPhraseIds.length ?? 0)
const completedScenarios = computed(() => d.value?.completedScenarioIds.length ?? 0)

const PALETTE = ['#f59e0b', '#6366f1', '#0ea5e9', '#10b981', '#ec4899', '#8b5cf6', '#f43f5e']

const distribution = computed(() => {
  const map = new Map<MistakeCategory, number>()
  for (const m of store.mistakes.value) map.set(m.category, (map.get(m.category) ?? 0) + m.frequency)
  return [...map.entries()].map(([category, total]) => ({ category, total })).sort((a, b) => b.total - a.total)
})
const totalMistakes = computed(() => distribution.value.reduce((s, x) => s + x.total, 0))

const chartData = computed<ChartData<'doughnut'>>(() => ({
  labels: distribution.value.map((x) => MISTAKE_LABELS[x.category]),
  datasets: [{
    data: distribution.value.map((x) => x.total),
    backgroundColor: distribution.value.map((_, i) => PALETTE[i % PALETTE.length]),
    borderWidth: 0,
    hoverOffset: 6,
  }],
}))
const chartOptions: ChartOptions<'doughnut'> = {
  responsive: true,
  maintainAspectRatio: false,
  cutout: '66%',
  plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => ` ${c.label}：${c.parsed} 次` } } },
}
const legend = computed(() =>
  distribution.value.map((x, i) => ({
    label: MISTAKE_LABELS[x.category], total: x.total, color: PALETTE[i % PALETTE.length],
    pct: totalMistakes.value ? Math.round((x.total / totalMistakes.value) * 100) : 0,
  })),
)
</script>

<template>
  <PageHeader eyebrow="AI English · 複習成長" title="學習進度" subtitle="你的練習量、掌握程度與常錯分布，一覽學習軌跡。" />

  <!-- Headline stats -->
  <div class="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
    <LearningStatCard label="連續學習" :value="`${d?.streakDays ?? 0} 天`" sub="streak" :icon="Flame" accent="text-orange-500 bg-orange-50" />
    <LearningStatCard label="學習時間" :value="`${d?.studyMinutes ?? 0} 分`" sub="累積" :icon="Clock" accent="text-sky-500 bg-sky-50" />
    <LearningStatCard label="口說練習" :value="`${d?.speakingMinutes ?? 0} 分`" :sub="`${d?.speechAttempts ?? 0} 次嘗試`" :icon="Mic" accent="text-rose-500 bg-rose-50" />
    <LearningStatCard label="完成情境" :value="completedScenarios" sub="對話練習" :icon="MessageSquareQuote" accent="text-brand-500 bg-brand-50" />
  </div>

  <div class="mb-6 grid gap-4 lg:grid-cols-2">
    <!-- Mastery -->
    <SectionCard :icon="Layers" title="掌握程度">
      <div class="grid grid-cols-2 gap-4">
        <LearningStatCard label="掌握單字" :value="masteredVocab" sub="個" :icon="BookOpen" accent="text-emerald-500 bg-emerald-50" />
        <LearningStatCard label="掌握句型" :value="masteredPhrases" sub="個" :icon="GraduationCap" accent="text-emerald-500 bg-emerald-50" />
      </div>
    </SectionCard>

    <!-- Mistake distribution -->
    <SectionCard :icon="AlertTriangle" title="常錯類型分布">
      <EmptyState v-if="!distribution.length" :icon="AlertTriangle" title="尚無常錯資料" description="練習後犯的錯會在這裡形成分布圖。" />
      <div v-else class="flex flex-col items-center gap-5 sm:flex-row">
        <div class="relative h-40 w-40 shrink-0">
          <Doughnut :data="chartData" :options="chartOptions" />
          <div class="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span class="text-xs text-ink-400">總次數</span>
            <span class="text-lg font-bold text-ink-900">{{ totalMistakes }}</span>
          </div>
        </div>
        <ul class="w-full flex-1 space-y-2">
          <li v-for="row in legend" :key="row.label" class="flex items-center gap-2.5 text-sm">
            <span class="h-2.5 w-2.5 shrink-0 rounded-full" :style="{ backgroundColor: row.color }" />
            <span class="text-ink-700">{{ row.label }}</span>
            <span class="ml-auto font-medium text-ink-900">{{ row.total }}</span>
            <span class="w-9 text-right text-xs text-ink-400">{{ row.pct }}%</span>
          </li>
        </ul>
      </div>
    </SectionCard>
  </div>
</template>
