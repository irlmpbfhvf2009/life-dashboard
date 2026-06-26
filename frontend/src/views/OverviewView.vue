<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import {
  NotebookPen, Scale, Wallet, BookOpen, Bot, Smile, ArrowRight, Sparkles,
  ListTodo, Loader2, Brain, TrendingDown, TrendingUp, Activity, Zap, MessageSquareText,
} from 'lucide-vue-next'
import { useAuthStore } from '@/stores/auth'
import { dashboardApi, aiApi } from '@/api'
import type { DashboardData } from '@/types'
import type { BriefInsight } from '@/api'
import TrendChartCard from '@/components/ui/TrendChartCard.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import { formatDate, formatMoney } from '@/utils/format'

const auth = useAuthStore()
const router = useRouter()

const data = ref<DashboardData | null>(null)
const loading = ref(true)

// AI brief: filled from /api/ai/brief when Gemini is configured; otherwise we
// keep the rule-based fallback below. aiUsed flips the "AI 生成 / 依數據" badge.
const aiBrief = ref<string | null>(null)
const aiSuggestion = ref<string | null>(null)
const aiInsights = ref<BriefInsight[] | null>(null)
const aiUsed = computed(() => aiBrief.value !== null)

onMounted(async () => {
  try {
    data.value = await dashboardApi.get()
  } catch {
    data.value = null
  } finally {
    loading.value = false
  }
  // Best-effort AI brief — silently falls back to the rule-based copy on 503/no key.
  try {
    const b = await aiApi.brief()
    if (b?.brief) {
      aiBrief.value = b.brief
      aiSuggestion.value = b.suggestion || null
      aiInsights.value = b.insights ?? []
    }
  } catch {
    // no AI configured — keep rule-based brief
  }
})

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

// ---- Derived metrics (all from real data, null-safe) ----
const todoDone = computed(() => data.value?.todayDoneCount ?? 0)
const todoTotal = computed(() => (data.value?.todayTodoCount ?? 0) + (data.value?.todayDoneCount ?? 0))
const todoRemaining = computed(() => Math.max(0, todoTotal.value - todoDone.value))
const todoPct = computed(() => (todoTotal.value ? Math.round((todoDone.value / todoTotal.value) * 100) : 0))

const weightTrend = computed(() => data.value?.weekWeightTrend ?? [])
const latestWeight = computed(() => (weightTrend.value.length ? weightTrend.value[weightTrend.value.length - 1].weight : null))
const weightChange = computed(() => {
  const t = weightTrend.value
  if (t.length < 2) return null
  return Number((t[t.length - 1].weight - t[0].weight).toFixed(1))
})
const weightLabels = computed(() => weightTrend.value.map((w) => w.date.slice(5)))
const weightData = computed(() => weightTrend.value.map((w) => w.weight))

const recentMoods = computed(() => data.value?.recentMoods ?? [])
const avgMood = computed(() => {
  const m = recentMoods.value
  if (!m.length) return null
  return Number((m.reduce((s, x) => s + x.moodScore, 0) / m.length).toFixed(1))
})
const recentNotes = computed(() => data.value?.recentNotes ?? [])
const recentFoods = computed(() => data.value?.recentFoods ?? [])
const monthExpense = computed(() => data.value?.monthExpenseTotal ?? 0)

const moodFaces = ['😖', '😞', '😐', '🙂', '😄']
const moodFace = (score: number) => moodFaces[Math.min(4, Math.max(0, Math.round(score) - 1))]
const mealLabels: Record<string, string> = { BREAKFAST: '早餐', LUNCH: '午餐', DINNER: '晚餐', SNACK: '點心' }

// ---- AI Brief: prefer the Gemini brief, else a rule-based summary ----
const ruleBrief = computed(() => {
  if (loading.value) return '正在整合你的今日數據…'
  const bits: string[] = []
  bits.push(todoTotal.value ? `今天 ${todoTotal.value} 件待辦、已完成 ${todoDone.value} 件` : '今天尚未安排待辦')
  if (monthExpense.value) bits.push(`本月支出 ${formatMoney(monthExpense.value)}`)
  if (weightChange.value !== null) bits.push(`體重近 7 天${weightChange.value <= 0 ? '下降' : '上升'} ${Math.abs(weightChange.value)} kg`)
  if (avgMood.value !== null) bits.push(`心情平均 ${avgMood.value}/5`)
  return bits.join('、') + '。'
})
const ruleSuggestion = computed(() => {
  if (loading.value) return ''
  if (todoRemaining.value >= 3) return `建議優先清理待辦——挑出最重要的 1–2 件先攻克。`
  if (todoRemaining.value > 0) return `只剩 ${todoRemaining.value} 件待辦，午後找空檔一鼓作氣完成。`
  if (avgMood.value !== null && avgMood.value < 3) return `最近心情偏低，安排一段散步或休息，照顧好自己。`
  if (weightChange.value !== null && weightChange.value > 0.3) return `體重微升，今天留意飲食份量、記得補水。`
  if (!todoTotal.value) return `先記下今天想做的事，讓司令艙幫你追蹤進度。`
  return `今天節奏穩定，保持下去就很好。`
})
const brief = computed(() => aiBrief.value ?? ruleBrief.value)
const suggestion = computed(() => aiSuggestion.value ?? ruleSuggestion.value)

// ---- Insight cards ----
interface Insight { key: string; icon: typeof Brain; grad: string; title: string; text: string }

// Pick an icon + gradient for an AI insight by matching keywords in its title.
function decorate(title: string): { icon: typeof Brain; grad: string } {
  if (/待辦|任務|工作/.test(title)) return { icon: ListTodo, grad: 'from-brand-400 to-violet-500' }
  if (/體重|健康|運動|斷食/.test(title)) return { icon: Activity, grad: 'from-emerald-400 to-teal-500' }
  if (/心情|情緒/.test(title)) return { icon: Smile, grad: 'from-rose-400 to-pink-500' }
  if (/財務|支出|花費|預算|錢/.test(title)) return { icon: Wallet, grad: 'from-amber-400 to-yellow-500' }
  return { icon: Brain, grad: 'from-brand-400 to-cyan-500' }
}

const insights = computed<Insight[]>(() => {
  // Prefer AI-generated insights when available.
  if (aiInsights.value && aiInsights.value.length) {
    return aiInsights.value.map((ins, i) => ({ key: 'ai-' + i, ...decorate(ins.title), title: ins.title, text: ins.text }))
  }
  const out: Insight[] = []
  if (todoTotal.value) {
    out.push({
      key: 'todo', icon: ListTodo, grad: 'from-brand-400 to-violet-500', title: '待辦完成率',
      text: todoPct.value >= 80 ? `已完成 ${todoPct.value}%，今天執行力很穩。`
        : todoPct.value >= 40 ? `完成 ${todoPct.value}%，再推進幾件就達標。`
          : `完成 ${todoPct.value}%，挑一件最關鍵的先動手。`,
    })
  }
  if (weightChange.value !== null) {
    const down = weightChange.value <= 0
    out.push({
      key: 'weight', icon: down ? TrendingDown : TrendingUp,
      grad: down ? 'from-emerald-400 to-teal-500' : 'from-amber-400 to-orange-500',
      title: '體重趨勢',
      text: down ? `近 7 天下降 ${Math.abs(weightChange.value)} kg，方向正確、繼續保持。`
        : `近 7 天上升 ${weightChange.value} kg，留意飲食與作息。`,
    })
  }
  if (avgMood.value !== null) {
    out.push({
      key: 'mood', icon: Smile,
      grad: avgMood.value >= 3.5 ? 'from-rose-400 to-pink-500' : 'from-sky-400 to-indigo-500',
      title: '心情狀態',
      text: avgMood.value >= 3.5 ? `平均 ${avgMood.value}/5，最近狀態不錯。`
        : `平均 ${avgMood.value}/5，給自己多一點喘息空間。`,
    })
  }
  if (monthExpense.value) {
    out.push({
      key: 'finance', icon: Wallet, grad: 'from-amber-400 to-yellow-500', title: '本月財務',
      text: `本月已支出 ${formatMoney(monthExpense.value)}，到財務分析看分類占比。`,
    })
  }
  return out
})

// ---- Quick capture ----
const GRAD: Record<string, string> = {
  amber: 'from-amber-400 to-orange-500',
  emerald: 'from-emerald-400 to-teal-500',
  rose: 'from-rose-400 to-pink-500',
  sky: 'from-sky-400 to-cyan-500',
  violet: 'from-violet-400 to-brand-500',
}
const quickActions = [
  { label: '記一筆帳', icon: Wallet, to: '/finance', tint: 'amber' },
  { label: '記體重', icon: Scale, to: '/health', tint: 'emerald' },
  { label: '記心情', icon: Smile, to: '/life', tint: 'rose' },
  { label: '新增筆記', icon: BookOpen, to: '/knowledge', tint: 'sky' },
  { label: '問 AI', icon: Bot, to: '/ai', tint: 'violet' },
]

// ---- Today status tiles ----
const statusTiles = computed(() => [
  { key: 'todo', label: '待辦', icon: ListTodo, grad: 'from-brand-400 to-violet-500', value: `${todoDone.value}/${todoTotal.value}`, sub: todoTotal.value ? `完成率 ${todoPct.value}%` : '尚無待辦', to: '/life' },
  { key: 'finance', label: '財務', icon: Wallet, grad: 'from-amber-400 to-orange-500', value: formatMoney(monthExpense.value), sub: '本月支出', to: '/finance' },
  { key: 'health', label: '健康', icon: Activity, grad: 'from-emerald-400 to-teal-500', value: latestWeight.value !== null ? latestWeight.value + ' kg' : '—', sub: weightChange.value !== null ? `近 7 天 ${weightChange.value <= 0 ? '↓' : '↑'} ${Math.abs(weightChange.value)} kg` : '尚無紀錄', to: '/health' },
  { key: 'mood', label: '心情', icon: Smile, grad: 'from-rose-400 to-pink-500', value: avgMood.value !== null ? avgMood.value + '/5' : '—', sub: '最近平均', to: '/life' },
])
</script>

<template>
  <div class="space-y-6">
    <!-- 1 ── 今日 AI Brief ───────────────────────────────────────────── -->
    <section class="glass glow-edge relative overflow-hidden rounded-3xl p-6 sm:p-8">
      <div class="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-brand-500/20 blur-3xl" />
      <div class="pointer-events-none absolute -bottom-28 left-10 h-64 w-64 rounded-full bg-cyan-400/10 blur-3xl" />

      <div class="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div class="min-w-0">
          <p class="flex flex-wrap items-center gap-2 text-2xs font-semibold uppercase tracking-[0.2em] text-brand-300">
            <span class="flex h-6 w-6 items-center justify-center rounded-lg bg-gradient-to-br from-brand-400 to-violet-500 text-white shadow-glow-brand">
              <Brain class="h-3.5 w-3.5" />
            </span>
            AI Brief · {{ todayLabel }}
            <span
              class="rounded-full border px-2 py-0.5 normal-case tracking-normal"
              :class="aiUsed ? 'border-cyan-400/30 bg-cyan-400/10 text-cyan-200' : 'border-ink-200/60 bg-ink-50/50 text-ink-400'"
            >{{ aiUsed ? 'AI 生成' : '依數據' }}</span>
          </p>
          <h1 class="mt-3 text-2xl font-bold tracking-tight text-ink-900 sm:text-3xl">
            {{ greeting }}，<span class="text-gradient">{{ auth.displayName }}</span>
          </h1>
          <p class="mt-2 max-w-2xl text-sm leading-relaxed text-ink-500">{{ brief }}</p>
          <p v-if="suggestion" class="mt-3 flex items-start gap-2 rounded-xl border border-brand-400/20 bg-brand-500/10 px-3.5 py-2.5 text-sm text-ink-700">
            <Sparkles class="mt-0.5 h-4 w-4 shrink-0 text-brand-300" />
            <span>{{ suggestion }}</span>
          </p>

          <div class="mt-5 flex flex-wrap gap-2">
            <span class="inline-flex items-center gap-1.5 rounded-lg border border-ink-200/60 bg-ink-50/50 px-3 py-1.5 text-xs text-ink-600 backdrop-blur">
              <ListTodo class="h-3.5 w-3.5 text-brand-300" /> 待辦 {{ todoDone }}/{{ todoTotal }}
            </span>
            <span v-if="avgMood !== null" class="inline-flex items-center gap-1.5 rounded-lg border border-ink-200/60 bg-ink-50/50 px-3 py-1.5 text-xs text-ink-600 backdrop-blur">
              <Smile class="h-3.5 w-3.5 text-rose-300" /> 心情 {{ avgMood }}/5
            </span>
            <span v-if="latestWeight !== null" class="inline-flex items-center gap-1.5 rounded-lg border border-ink-200/60 bg-ink-50/50 px-3 py-1.5 text-xs text-ink-600 backdrop-blur">
              <Scale class="h-3.5 w-3.5 text-emerald-300" /> {{ latestWeight }} kg
            </span>
          </div>
        </div>

        <div class="shrink-0">
          <button
            class="group inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-brand-500 to-violet-600 px-5 py-3 text-sm font-semibold text-white shadow-glow-brand transition-all hover:shadow-glow-cyan lg:w-auto"
            @click="router.push('/ai')"
          >
            <MessageSquareText class="h-4 w-4" /> 問 AI 助手
            <ArrowRight class="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </button>
        </div>
      </div>
    </section>

    <!-- 2 ── 快速紀錄 ─────────────────────────────────────────────────── -->
    <section>
      <p class="mb-3 flex items-center gap-1.5 text-2xs font-semibold uppercase tracking-wider text-ink-400">
        <Zap class="h-3.5 w-3.5 text-cyan-300" /> 快速紀錄
      </p>
      <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <button
          v-for="a in quickActions" :key="a.label"
          class="glass glass-hover group flex flex-col items-center gap-2.5 rounded-2xl p-4 text-center ring-focus"
          @click="router.push(a.to)"
        >
          <span class="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-glow-brand transition-transform group-hover:scale-105" :class="GRAD[a.tint]">
            <component :is="a.icon" class="h-5 w-5" :stroke-width="2" />
          </span>
          <span class="text-sm font-medium text-ink-700">{{ a.label }}</span>
        </button>
      </div>
    </section>

    <!-- 3 ── 今日狀態 ─────────────────────────────────────────────────── -->
    <section>
      <p class="mb-3 flex items-center gap-1.5 text-2xs font-semibold uppercase tracking-wider text-ink-400">
        <Activity class="h-3.5 w-3.5 text-brand-300" /> 今日狀態
      </p>
      <div class="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <button
          v-for="s in statusTiles" :key="s.key"
          class="glass glass-hover group flex flex-col gap-3 rounded-2xl p-4 text-left ring-focus"
          @click="router.push(s.to)"
        >
          <div class="flex items-center justify-between">
            <span class="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br text-white" :class="s.grad">
              <component :is="s.icon" class="h-[18px] w-[18px]" :stroke-width="2" />
            </span>
            <ArrowRight class="h-4 w-4 text-ink-300 opacity-0 transition-opacity group-hover:opacity-100" />
          </div>
          <div>
            <p class="text-xl font-bold tracking-tight text-ink-900">
              <span v-if="loading" class="inline-block h-6 w-16 animate-pulse rounded bg-ink-200/60" />
              <template v-else>{{ s.value }}</template>
            </p>
            <p class="mt-0.5 text-2xs text-ink-400">{{ s.label }} · {{ s.sub }}</p>
          </div>
        </button>
      </div>
    </section>

    <!-- 4 ── AI 洞察 ─────────────────────────────────────────────────── -->
    <section v-if="insights.length || loading">
      <p class="mb-3 flex items-center gap-1.5 text-2xs font-semibold uppercase tracking-wider text-ink-400">
        <Brain class="h-3.5 w-3.5 text-violet-300" /> AI 洞察
      </p>
      <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div
          v-for="ins in insights" :key="ins.key"
          class="glass relative overflow-hidden rounded-2xl p-4"
        >
          <div class="flex items-start gap-3">
            <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br text-white" :class="ins.grad">
              <component :is="ins.icon" class="h-[18px] w-[18px]" :stroke-width="2" />
            </span>
            <div class="min-w-0">
              <p class="text-sm font-semibold text-ink-800">{{ ins.title }}</p>
              <p class="mt-1 text-xs leading-relaxed text-ink-500">{{ ins.text }}</p>
            </div>
          </div>
        </div>
        <div v-if="loading && !insights.length" class="glass flex items-center gap-2 rounded-2xl p-4 text-xs text-ink-400">
          <Loader2 class="h-3.5 w-3.5 animate-spin" /> 分析你的數據中…
        </div>
      </div>
    </section>

    <!-- 5 ── 最近紀錄與趨勢 ───────────────────────────────────────────── -->
    <section>
      <p class="mb-3 flex items-center gap-1.5 text-2xs font-semibold uppercase tracking-wider text-ink-400">
        <TrendingUp class="h-3.5 w-3.5 text-cyan-300" /> 最近紀錄與趨勢
      </p>
      <div class="grid gap-4 lg:grid-cols-3">
        <!-- Trend chart -->
        <div class="lg:col-span-2">
          <TrendChartCard
            v-if="weightData.length >= 2"
            title="本週體重趨勢"
            :labels="weightLabels"
            :data="weightData"
            color="#818cf8"
          />
          <div v-else class="glass flex h-full flex-col rounded-2xl p-5">
            <div class="mb-2 flex items-center justify-between">
              <h3 class="section-title">本週體重趨勢</h3>
              <button class="inline-flex items-center gap-1 text-xs font-medium text-brand-300 hover:text-brand-200" @click="router.push('/health')">
                去記錄 <ArrowRight class="h-3.5 w-3.5" />
              </button>
            </div>
            <EmptyState :icon="Scale" title="還沒有足夠的體重紀錄" description="到健康減脂記錄體重，這裡就會畫出趨勢。" />
          </div>
        </div>

        <!-- Recent moods -->
        <div class="glass flex flex-col rounded-2xl p-5">
          <div class="mb-3 flex items-center justify-between">
            <h3 class="section-title flex items-center gap-2"><Smile class="h-4 w-4 text-rose-300" /> 最近心情</h3>
            <button class="inline-flex items-center gap-1 text-xs font-medium text-brand-300 hover:text-brand-200" @click="router.push('/life')">
              全部 <ArrowRight class="h-3.5 w-3.5" />
            </button>
          </div>
          <ul v-if="recentMoods.length" class="space-y-2.5">
            <li v-for="m in recentMoods.slice(0, 4)" :key="m.id"
              class="group cursor-pointer rounded-xl border border-ink-200/50 bg-ink-50/40 p-3 transition-colors hover:border-brand-400/30"
              @click="router.push('/life')">
              <div class="flex items-start justify-between gap-3">
                <span class="text-lg leading-none">{{ moodFace(m.moodScore) }}</span>
                <span class="shrink-0 text-2xs text-ink-400">{{ formatDate(m.date) }}</span>
              </div>
              <p v-if="m.note" class="mt-1 line-clamp-2 text-xs text-ink-500">{{ m.note }}</p>
            </li>
          </ul>
          <EmptyState v-else :icon="Smile" title="還沒有心情紀錄" description="到生活管理寫下今天的心情。" />
        </div>
      </div>

      <!-- Recent notes + foods -->
      <div class="mt-4 grid gap-4 lg:grid-cols-2">
        <div class="glass flex flex-col rounded-2xl p-5">
          <div class="mb-3 flex items-center justify-between">
            <h3 class="section-title flex items-center gap-2"><NotebookPen class="h-4 w-4 text-sky-300" /> 最近筆記</h3>
            <button class="inline-flex items-center gap-1 text-xs font-medium text-brand-300 hover:text-brand-200" @click="router.push('/knowledge')">
              全部 <ArrowRight class="h-3.5 w-3.5" />
            </button>
          </div>
          <ul v-if="recentNotes.length" class="space-y-1.5">
            <li v-for="n in recentNotes.slice(0, 5)" :key="n.id"
              class="group cursor-pointer rounded-lg border border-ink-200/40 px-3 py-2.5 transition-colors hover:border-brand-400/30 hover:bg-ink-50/40"
              @click="router.push('/knowledge')">
              <p class="truncate text-sm font-medium text-ink-800 group-hover:text-brand-200">{{ n.title || '(未命名筆記)' }}</p>
              <p class="mt-0.5 text-2xs text-ink-400">{{ formatDate(n.updatedAt) }}</p>
            </li>
          </ul>
          <EmptyState v-else :icon="BookOpen" title="還沒有筆記" description="到知識庫新增第一篇筆記。" />
        </div>

        <div class="glass flex flex-col rounded-2xl p-5">
          <div class="mb-3 flex items-center justify-between">
            <h3 class="section-title flex items-center gap-2"><Wallet class="h-4 w-4 text-amber-300" /> 財務摘要</h3>
            <button class="inline-flex items-center gap-1 text-xs font-medium text-brand-300 hover:text-brand-200" @click="router.push('/finance')">
              開啟 <ArrowRight class="h-3.5 w-3.5" />
            </button>
          </div>
          <div class="rounded-xl border border-ink-200/50 bg-ink-50/40 p-4">
            <div class="flex items-center justify-between">
              <span class="text-sm text-ink-500">本月支出</span>
              <span class="text-lg font-bold text-ink-900">{{ formatMoney(monthExpense) }}</span>
            </div>
          </div>
          <ul v-if="recentFoods.length" class="mt-3 space-y-2">
            <li v-for="f in recentFoods.slice(0, 3)" :key="f.id" class="flex items-center justify-between gap-3">
              <span class="min-w-0 flex-1 truncate text-xs text-ink-600">{{ f.foodText }}</span>
              <span class="badge badge-gray shrink-0">{{ mealLabels[f.mealType] ?? f.mealType }}</span>
            </li>
          </ul>
        </div>
      </div>
    </section>

    <p v-if="loading" class="flex items-center justify-center gap-2 text-xs text-ink-400">
      <Loader2 class="h-3.5 w-3.5 animate-spin" /> 正在載入最新資料…
    </p>
  </div>
</template>
