<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import {
  NotebookPen, Scale, Wallet, BookOpen, Bot,
  Smile, Target, ArrowRight, Sparkles, UtensilsCrossed,
  ListTodo, Loader2,
} from 'lucide-vue-next'
import { useAuthStore } from '@/stores/auth'
import { dashboardApi } from '@/api'
import type { DashboardData } from '@/types'
import StatCard from '@/components/ui/StatCard.vue'
import SectionCard from '@/components/ui/SectionCard.vue'
import TrendChartCard from '@/components/ui/TrendChartCard.vue'
import QuickActionButton from '@/components/ui/QuickActionButton.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import { formatDate, formatMoney } from '@/utils/format'

const auth = useAuthStore()
const router = useRouter()

const data = ref<DashboardData | null>(null)
const loading = ref(true)

onMounted(async () => {
  try {
    data.value = await dashboardApi.get()
  } catch {
    // The dashboard is best-effort; on failure we show empty states with
    // prompts to start logging rather than blocking the page.
    data.value = null
  } finally {
    loading.value = false
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

// ---- Derived, all from real data (null-safe) ----
const todoDone = computed(() => data.value?.todayDoneCount ?? 0)
const todoTotal = computed(() => (data.value?.todayTodoCount ?? 0) + (data.value?.todayDoneCount ?? 0))

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

const quickActions = [
  { label: '記一筆帳', icon: Wallet, to: '/finance' },
  { label: '記體重', icon: Scale, to: '/health' },
  { label: '記心情', icon: Smile, to: '/life' },
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
        <template v-if="loading">載入你的今日概況…</template>
        <template v-else-if="todoTotal">今天有 {{ todoTotal }} 件待辦，已完成 {{ todoDone }} 件，繼續加油。</template>
        <template v-else>今天還沒有安排待辦，隨手記下想做的事吧。</template>
      </p>
      <div class="mt-5 flex flex-wrap gap-2.5">
        <span class="inline-flex items-center gap-1.5 rounded-lg bg-white/15 px-3 py-1.5 text-sm backdrop-blur">
          <ListTodo class="h-4 w-4" /> 今日待辦 {{ todoDone }}/{{ todoTotal }}
        </span>
        <span v-if="avgMood !== null" class="inline-flex items-center gap-1.5 rounded-lg bg-white/15 px-3 py-1.5 text-sm backdrop-blur">
          <Smile class="h-4 w-4" /> 近期心情 {{ avgMood }}/5
        </span>
        <span v-if="latestWeight !== null" class="inline-flex items-center gap-1.5 rounded-lg bg-white/15 px-3 py-1.5 text-sm backdrop-blur">
          <Scale class="h-4 w-4" /> 最新體重 {{ latestWeight }} kg
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

    <!-- Stat row (real) -->
    <section class="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <StatCard label="今日待辦" :value="`${todoDone}/${todoTotal}`" :icon="Target" sub="已完成 / 總數" />
      <StatCard label="本月支出" :value="formatMoney(monthExpense)" :icon="Wallet" sub="本月累計" />
      <StatCard
        label="最新體重"
        :value="latestWeight !== null ? latestWeight + ' kg' : '—'"
        :icon="Scale"
        :trend="weightChange !== null ? { dir: weightChange <= 0 ? 'down' : 'up', value: Math.abs(weightChange) + ' kg', good: weightChange <= 0 } : undefined"
        sub="近 7 天變化"
      />
      <StatCard
        label="近期心情"
        :value="avgMood !== null ? avgMood + '/5' : '—'"
        :icon="Smile"
        sub="最近平均"
      />
    </section>

    <!-- Main grid -->
    <div class="grid gap-6 lg:grid-cols-3">
      <!-- Left 2/3 -->
      <div class="space-y-6 lg:col-span-2">
        <TrendChartCard
          v-if="weightData.length >= 2"
          title="本週體重趨勢"
          :labels="weightLabels"
          :data="weightData"
          color="#6366f1"
        />
        <SectionCard v-else title="本週體重趨勢" :icon="Scale">
          <EmptyState
            :icon="Scale"
            title="還沒有足夠的體重紀錄"
            description="到健康減脂記錄體重，這裡就會畫出趨勢。"
          />
          <template #action>
            <button class="inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-700" @click="router.push('/health')">
              去記錄 <ArrowRight class="h-3.5 w-3.5" />
            </button>
          </template>
        </SectionCard>

        <SectionCard title="最近心情" :icon="Smile">
          <template #action>
            <button class="inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-700" @click="router.push('/life')">
              查看全部 <ArrowRight class="h-3.5 w-3.5" />
            </button>
          </template>
          <ul v-if="recentMoods.length" class="space-y-3">
            <li v-for="m in recentMoods" :key="m.id"
              class="group cursor-pointer rounded-xl border border-ink-100 p-4 transition-colors hover:border-ink-200 hover:bg-ink-50/60"
              @click="router.push('/life')">
              <div class="flex items-start justify-between gap-3">
                <span class="text-xl leading-none">{{ moodFace(m.moodScore) }}</span>
                <span class="shrink-0 text-2xs text-ink-400">{{ formatDate(m.date) }}</span>
              </div>
              <p v-if="m.note" class="mt-1.5 line-clamp-2 text-sm text-ink-500">{{ m.note }}</p>
              <p v-else class="mt-1.5 text-sm text-ink-300">心情 {{ m.moodScore }}/5</p>
            </li>
          </ul>
          <EmptyState
            v-else
            :icon="Smile"
            title="還沒有心情紀錄"
            description="到生活管理寫下今天的心情日記。"
          />
        </SectionCard>
      </div>

      <!-- Right 1/3 -->
      <div class="space-y-6">
        <SectionCard title="財務摘要" :icon="Wallet">
          <template #action>
            <button class="inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-700" @click="router.push('/finance')">
              開啟 <ArrowRight class="h-3.5 w-3.5" />
            </button>
          </template>
          <div class="flex items-center justify-between">
            <span class="text-sm text-ink-500">本月支出</span>
            <span class="text-lg font-semibold text-ink-900">{{ formatMoney(monthExpense) }}</span>
          </div>
          <p class="mt-2 text-2xs text-ink-400">含本月所有已記錄的支出。</p>
        </SectionCard>

        <SectionCard title="最近筆記" :icon="NotebookPen">
          <template #action>
            <button class="inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-700" @click="router.push('/knowledge')">
              查看全部 <ArrowRight class="h-3.5 w-3.5" />
            </button>
          </template>
          <ul v-if="recentNotes.length" class="space-y-2">
            <li v-for="n in recentNotes" :key="n.id"
              class="group cursor-pointer rounded-lg border border-ink-100 px-3 py-2.5 transition-colors hover:border-ink-200 hover:bg-ink-50/60"
              @click="router.push('/knowledge')">
              <p class="truncate text-sm font-medium text-ink-800 group-hover:text-brand-700">{{ n.title || '(未命名筆記)' }}</p>
              <p class="mt-0.5 text-2xs text-ink-400">{{ formatDate(n.updatedAt) }}</p>
            </li>
          </ul>
          <EmptyState
            v-else
            :icon="BookOpen"
            title="還沒有筆記"
            description="到知識庫新增第一篇筆記。"
          />
        </SectionCard>

        <SectionCard v-if="recentFoods.length" title="最近飲食" :icon="UtensilsCrossed">
          <template #action>
            <button class="inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-700" @click="router.push('/health')">
              查看 <ArrowRight class="h-3.5 w-3.5" />
            </button>
          </template>
          <ul class="space-y-2">
            <li v-for="f in recentFoods" :key="f.id" class="flex items-center justify-between gap-3">
              <span class="min-w-0 flex-1 truncate text-sm text-ink-700">{{ f.foodText }}</span>
              <span class="badge badge-gray shrink-0">{{ mealLabels[f.mealType] ?? f.mealType }}</span>
            </li>
          </ul>
        </SectionCard>
      </div>
    </div>

    <!-- Subtle loading hint on first paint -->
    <p v-if="loading" class="flex items-center justify-center gap-2 text-xs text-ink-400">
      <Loader2 class="h-3.5 w-3.5 animate-spin" /> 正在載入最新資料…
    </p>
  </div>
</template>
