<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import {
  NotebookPen, Scale, Wallet, BookOpen, Bot,
  Smile, Flame, Target, TrendingDown, ArrowRight, Sparkles,
} from 'lucide-vue-next'
import { useAuthStore } from '@/stores/auth'
import StatCard from '@/components/ui/StatCard.vue'
import ProgressCard from '@/components/ui/ProgressCard.vue'
import SectionCard from '@/components/ui/SectionCard.vue'
import TrendChartCard from '@/components/ui/TrendChartCard.vue'
import QuickActionButton from '@/components/ui/QuickActionButton.vue'
import TagBadge from '@/components/ui/TagBadge.vue'
import { formatDate, formatMoney } from '@/utils/format'
import {
  todayStatus, weightProgress, habitSummary, financeSummary,
  recentJournals, weekTrend, stockWatchlist,
} from '@/data/mock'

const auth = useAuthStore()
const router = useRouter()

const greeting = computed(() => {
  const h = new Date().getHours()
  if (h < 6) return '夜深了'
  if (h < 12) return '早安'
  if (h < 18) return '午安'
  return '晚安'
})
const todayLabel = new Date().toLocaleDateString('zh-TW', {
  year: 'numeric', month: 'long', day: 'numeric', weekday: 'long',
})

const toGoal = computed(() => (weightProgress.current - weightProgress.target).toFixed(1))
const lostSoFar = computed(() => (weightProgress.start - weightProgress.current).toFixed(1))

const quickActions = [
  { label: '寫日記', icon: NotebookPen, to: '/life' },
  { label: '記體重', icon: Scale, to: '/health' },
  { label: '記一筆帳', icon: Wallet, to: '/finance' },
  { label: '新增筆記', icon: BookOpen, to: '/knowledge' },
  { label: '開啟 AI', icon: Bot, to: '/ai' },
]
</script>

<template>
  <div class="space-y-7">
    <!-- Hero -->
    <section class="relative overflow-hidden rounded-2xl border border-ink-200 bg-gradient-to-br from-brand-600 via-brand-600 to-violet-600 p-6 text-white shadow-card sm:p-8">
      <div class="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
      <p class="text-sm text-white/70">{{ todayLabel }}</p>
      <h1 class="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
        {{ greeting }}，{{ auth.displayName }}
      </h1>
      <p class="mt-2 flex items-center gap-2 text-sm text-white/85">
        <Sparkles class="h-4 w-4" />
        {{ todayStatus.focusNote }}
      </p>
      <div class="mt-5 flex flex-wrap gap-2.5">
        <span class="inline-flex items-center gap-1.5 rounded-lg bg-white/15 px-3 py-1.5 text-sm backdrop-blur">
          <Smile class="h-4 w-4" /> 今日心情 {{ todayStatus.mood }}/5
        </span>
        <span class="inline-flex items-center gap-1.5 rounded-lg bg-white/15 px-3 py-1.5 text-sm backdrop-blur">
          完成度 {{ todayStatus.completion }}%
        </span>
        <span class="inline-flex items-center gap-1.5 rounded-lg bg-white/15 px-3 py-1.5 text-sm backdrop-blur">
          <Flame class="h-4 w-4" /> 習慣連續 {{ habitSummary.streak }} 天
        </span>
      </div>
    </section>

    <!-- Quick actions -->
    <section>
      <p class="eyebrow mb-3">快速操作</p>
      <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <QuickActionButton
          v-for="a in quickActions"
          :key="a.label"
          :label="a.label"
          :icon="a.icon"
          @click="router.push(a.to)"
        />
      </div>
    </section>

    <!-- Stat row -->
    <section class="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <StatCard label="今日完成度" :value="todayStatus.completion + '%'" :icon="Target" sub="今日重點任務" />
      <StatCard label="習慣連續天數" :value="habitSummary.streak" :icon="Flame" sub="保持下去" />
      <StatCard label="本月支出" :value="formatMoney(financeSummary.monthSpend)" :icon="Wallet"
        :trend="{ dir: 'down', value: Math.abs(financeSummary.changeVsLastMonth) + '%', good: true }" sub="較上月" />
      <StatCard label="距離目標體重" :value="toGoal + ' kg'" :icon="TrendingDown"
        :trend="{ dir: 'down', value: lostSoFar + ' kg', good: true }" sub="已減去" />
    </section>

    <!-- Main grid -->
    <div class="grid gap-6 lg:grid-cols-3">
      <!-- Left 2/3 -->
      <div class="space-y-6 lg:col-span-2">
        <TrendChartCard title="本週體重趨勢" :labels="weekTrend.labels" :data="weekTrend.weight" color="#6366f1" />

        <SectionCard title="最近日記" :icon="NotebookPen">
          <template #action>
            <button class="inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-700" @click="router.push('/life')">
              查看全部 <ArrowRight class="h-3.5 w-3.5" />
            </button>
          </template>
          <ul class="space-y-3">
            <li v-for="j in recentJournals" :key="j.id"
              class="group cursor-pointer rounded-xl border border-ink-100 p-4 transition-colors hover:border-ink-200 hover:bg-ink-50/60"
              @click="router.push('/life')">
              <div class="flex items-start justify-between gap-3">
                <h4 class="text-sm font-semibold text-ink-800 group-hover:text-brand-700">{{ j.title }}</h4>
                <span class="shrink-0 text-2xs text-ink-400">{{ formatDate(j.date) }}</span>
              </div>
              <p class="mt-1 line-clamp-2 text-sm text-ink-500">{{ j.excerpt }}</p>
              <div class="mt-2.5 flex flex-wrap gap-1.5">
                <TagBadge v-for="t in j.tags" :key="t" :label="t" />
              </div>
            </li>
          </ul>
        </SectionCard>
      </div>

      <!-- Right 1/3 -->
      <div class="space-y-6">
        <ProgressCard
          title="減脂進度"
          :icon="Scale"
          :value="Number(lostSoFar)"
          :max="weightProgress.start - weightProgress.target"
          unit="kg"
          accent="emerald"
          :caption="`目前 ${weightProgress.current}kg，目標 ${weightProgress.target}kg`"
        />
        <ProgressCard
          title="今日習慣"
          :icon="Flame"
          :value="habitSummary.todayDone"
          :max="habitSummary.todayTotal"
          unit="項"
          accent="brand"
          :caption="`本週完成率 ${habitSummary.weekRate}%`"
        />

        <SectionCard title="財務摘要" :icon="Wallet">
          <div class="space-y-3">
            <div class="flex items-center justify-between">
              <span class="text-sm text-ink-500">本月支出</span>
              <span class="font-semibold text-ink-900">{{ formatMoney(financeSummary.monthSpend) }}</span>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-sm text-ink-500">最大分類</span>
              <span class="badge-amber">{{ financeSummary.topCategory }} · {{ formatMoney(financeSummary.topCategoryAmount) }}</span>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-sm text-ink-500">較上月</span>
              <span class="inline-flex items-center gap-0.5 text-sm font-semibold text-emerald-600">
                <TrendingDown class="h-4 w-4" /> {{ Math.abs(financeSummary.changeVsLastMonth) }}%
              </span>
            </div>
          </div>
        </SectionCard>

        <SectionCard title="AI 股票研究" :icon="Bot">
          <template #action>
            <button class="inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-700" @click="router.push('/ai/stock')">
              開啟 <ArrowRight class="h-3.5 w-3.5" />
            </button>
          </template>
          <ul class="space-y-2">
            <li v-for="s in stockWatchlist.slice(0, 3)" :key="s.symbol" class="flex items-center justify-between rounded-lg px-1 py-1.5">
              <div>
                <span class="text-sm font-medium text-ink-800">{{ s.name }}</span>
                <span class="ml-1.5 text-2xs text-ink-400">{{ s.symbol }}</span>
              </div>
              <span class="badge" :class="s.score >= 75 ? 'badge-green' : s.score >= 60 ? 'badge-amber' : 'badge-gray'">評分 {{ s.score }}</span>
            </li>
          </ul>
          <p class="mt-3 text-2xs text-ink-400">僅供研究與模擬分析，不構成投資建議。</p>
        </SectionCard>
      </div>
    </div>
  </div>
</template>
