<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import {
  FlaskConical, LineChart, GraduationCap, Bot, ArrowRight,
  Sparkles, CheckCircle2, AlertTriangle, Loader2, Flame, ListTodo, RotateCcw,
} from 'lucide-vue-next'
import PageHeader from '@/components/ui/PageHeader.vue'
import SectionCard from '@/components/ui/SectionCard.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import { aiApi } from '@/api'
import { stockResearchApi } from '@/api/stockResearch'
import { useEnglishStore } from '@/composables/useEnglishStore'
import { formatDate } from '@/utils/format'
import type { AppStatus } from '@/config/navigation'

interface AiApp {
  to: string
  name: string
  description: string
  status: AppStatus
  icon: typeof LineChart
  tint: string
  features: string[]
}

const apps: AiApp[] = [
  {
    to: '/ai/stock',
    name: 'AI 股票研究',
    description: '台股每日掃描＋AI 八面向分析，研究與模擬用途（非投資建議）。',
    status: 'BETA',
    icon: LineChart,
    tint: 'text-rose-600 bg-rose-50',
    features: ['今日 AI 精選（行情＋K 線＋八面向）', '雷達選股與命中率追蹤', '過往分析存檔'],
  },
  {
    to: '/ai/english',
    name: 'AI 英文教練',
    description: '對話練習、即時糾錯、口說評分與間隔複習，全程瀏覽器原生語音。',
    status: 'BETA',
    icon: GraduationCap,
    tint: 'text-brand-600 bg-brand-50',
    features: ['AI 對話室＋句子修正', '單字／句型／文法與情境', 'streak、常錯庫與複習成長'],
  },
  {
    to: '/ai/data-lab',
    name: '資料分析工具',
    description: '上傳 CSV，自動欄位統計與圖表，再用 AI 產生洞察摘要。',
    status: 'ACTIVE',
    icon: Bot,
    tint: 'text-violet-600 bg-violet-50',
    features: ['CSV 解析與欄位型別判斷', '描述統計與快速圖表', 'AI 洞察與建議'],
  },
]

// Personalised English-Coach progress (synced per-user, lightweight reactive reads).
const english = useEnglishStore()
const learnStats = computed(() => [
  { key: 'streak', label: '連續學習', value: english.data.value?.streakDays ?? 0, unit: '天', icon: Flame, tint: 'text-rose-600 bg-rose-50' },
  { key: 'mission', label: '今日任務', value: english.mission.value?.completedCount ?? 0, sub: `/ ${english.mission.value?.totalCount ?? 0}`, icon: ListTodo, tint: 'text-brand-600 bg-brand-50' },
  { key: 'review', label: '待複習', value: english.dueReviews.value.length, unit: '項', icon: RotateCcw, tint: 'text-violet-600 bg-violet-50' },
])

// In-app AI runs on Gemini; surface whether the key is wired so users know
// why the conversational features may be in fallback mode.
const aiEnabled = ref<boolean | null>(null)

// Live stock-pipeline snapshot, read straight from the GitHub-raw JSON.
const stockPicks = ref<number | null>(null)
const stockUpdated = ref<string | null>(null)

onMounted(async () => {
  try {
    const res = await aiApi.status()
    aiEnabled.value = res.enabled
  } catch {
    aiEnabled.value = false
  }
  try {
    const a = await stockResearchApi.analysis()
    stockPicks.value = a.stocks?.length ?? 0
    stockUpdated.value = a.updated_at ?? null
  } catch {
    // Pipeline JSON may be missing/unreachable — just omit the live line.
  }
})
</script>

<template>
  <div>
    <PageHeader
      :icon="FlaskConical"
      eyebrow="AI Lab"
      title="AI 實驗室"
      subtitle="AI 股票研究、英文教練與資料分析工具，皆為研究與學習用途。"
    />

    <!-- Hero / engine status -->
    <div class="mb-6 overflow-hidden rounded-2xl border border-ink-200 bg-gradient-to-br from-brand-500 to-violet-600 p-6 text-white">
      <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div class="flex items-center gap-2 text-white/80">
            <Sparkles class="h-4 w-4" />
            <span class="text-sm font-medium">AI 引擎</span>
          </div>
          <h2 class="mt-1 text-2xl font-bold tracking-tight">Powered by Gemini</h2>
          <p class="mt-1 max-w-md text-sm text-white/80">
            對話、糾錯與洞察類功能由後端 Gemini 提供；股票管線則離線預先產出，直接讀取結果。
          </p>
        </div>
        <div class="shrink-0 rounded-xl bg-white/15 px-4 py-3 backdrop-blur">
          <p class="text-xs text-white/70">即時 AI 狀態</p>
          <p class="mt-1 flex items-center gap-1.5 text-sm font-semibold">
            <Loader2 v-if="aiEnabled === null" class="h-4 w-4 animate-spin" />
            <CheckCircle2 v-else-if="aiEnabled" class="h-4 w-4" />
            <AlertTriangle v-else class="h-4 w-4" />
            <span v-if="aiEnabled === null">檢查中…</span>
            <span v-else-if="aiEnabled">已啟用</span>
            <span v-else>降級模式</span>
          </p>
        </div>
      </div>
    </div>

    <!-- Personalised learning progress -->
    <RouterLink
      to="/ai/english"
      class="group mb-6 flex flex-col gap-4 rounded-2xl border border-ink-200 bg-surface p-5 shadow-card transition-all hover:border-brand-200 hover:shadow-card-hover sm:flex-row sm:items-center sm:justify-between"
    >
      <div class="flex items-center gap-2 text-sm font-semibold text-ink-700">
        <GraduationCap class="h-4 w-4 text-brand-500" :stroke-width="2" />
        <span>你的學習進度</span>
        <ArrowRight class="h-3.5 w-3.5 text-brand-500 opacity-0 transition-opacity group-hover:opacity-100" />
      </div>
      <div class="grid grid-cols-3 gap-3">
        <div v-for="s in learnStats" :key="s.key" class="flex items-center gap-2.5">
          <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg" :class="s.tint">
            <component :is="s.icon" class="h-[18px] w-[18px]" :stroke-width="2" />
          </span>
          <div class="leading-tight">
            <p class="text-lg font-bold text-ink-800">
              {{ s.value }}<span v-if="s.unit" class="ml-0.5 text-xs font-medium text-ink-400">{{ s.unit }}</span><span v-if="s.sub" class="text-xs font-medium text-ink-400">{{ s.sub }}</span>
            </p>
            <p class="text-2xs text-ink-400">{{ s.label }}</p>
          </div>
        </div>
      </div>
    </RouterLink>

    <!-- App entries -->
    <div class="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <RouterLink
        v-for="app in apps"
        :key="app.to"
        :to="app.to"
        class="group flex flex-col rounded-2xl border border-ink-200 bg-surface p-5 shadow-card transition-all hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-card-hover ring-focus"
      >
        <div class="mb-4 flex items-start justify-between">
          <span class="flex h-11 w-11 items-center justify-center rounded-xl" :class="app.tint">
            <component :is="app.icon" class="h-5 w-5" :stroke-width="2" />
          </span>
          <StatusBadge :status="app.status" />
        </div>

        <h3 class="text-[15px] font-semibold text-ink-800">{{ app.name }}</h3>
        <p class="mt-1 text-sm text-ink-500">{{ app.description }}</p>

        <ul class="mt-4 space-y-1.5">
          <li v-for="f in app.features" :key="f" class="flex items-start gap-2 text-xs text-ink-500">
            <CheckCircle2 class="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-500" :stroke-width="2" />
            <span>{{ f }}</span>
          </li>
        </ul>

        <div class="mt-4 flex items-center justify-between border-t border-ink-100 pt-3">
          <span class="text-2xs text-ink-400">
            <template v-if="app.to === '/ai/stock' && stockPicks !== null">
              今日 {{ stockPicks }} 檔精選<template v-if="stockUpdated"> · {{ formatDate(stockUpdated) }} 更新</template>
            </template>
          </span>
          <span class="inline-flex items-center gap-1 text-xs font-medium text-brand-600 opacity-0 transition-opacity group-hover:opacity-100">
            進入 <ArrowRight class="h-3.5 w-3.5" />
          </span>
        </div>
      </RouterLink>
    </div>

    <!-- Disclaimer -->
    <SectionCard title="使用須知" :icon="FlaskConical">
      <ul class="space-y-2 text-sm text-ink-500">
        <li class="flex items-start gap-2">
          <span class="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-ink-300" />
          股票相關內容為研究與模擬，<span class="font-medium text-ink-700">非投資建議</span>，請自行判斷風險。
        </li>
        <li class="flex items-start gap-2">
          <span class="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-ink-300" />
          當 AI 狀態為「降級模式」時，對話與洞察會改用內建範例回應，功能不會中斷。
        </li>
      </ul>
    </SectionCard>
  </div>
</template>
