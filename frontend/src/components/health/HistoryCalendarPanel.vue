<script setup lang="ts">
import { computed, ref } from 'vue'
import { ChevronLeft, ChevronRight, CalendarDays, Flame, Sparkles, Scale } from 'lucide-vue-next'
import { computeMetrics, summarizeDay } from '@/utils/healthPlan'
import { useHealthStore } from '@/composables/useHealthStore'
import type { DailySummary, HealthProfile } from '@/data/health'

const props = defineProps<{ profile: HealthProfile }>()
const store = useHealthStore()

const tdee = computed(() => computeMetrics(props.profile).tdee)

function localToday(): string {
  return new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10)
}
const todayKey = localToday()

// ---- All logged days: frozen history + today's live entries (today wins) ----
const summaries = computed<Record<string, DailySummary>>(() => {
  const map: Record<string, DailySummary> = {}
  for (const s of store.log.value?.history ?? []) map[s.date] = s
  const entries = store.log.value?.entries ?? []
  if (entries.length) map[todayKey] = summarizeDay(todayKey, entries, store.log.value?.review ?? null)
  return map
})
const weightByDate = computed<Record<string, number>>(() => {
  const map: Record<string, number> = {}
  for (const p of store.log.value?.weightHistory ?? []) map[p.date] = p.kg
  return map
})

const deficitOf = (s: DailySummary) => tdee.value - s.intake + s.burned

// ---- Visible month ----
const cursor = ref(new Date(todayKey + 'T00:00:00'))
const year = computed(() => cursor.value.getFullYear())
const month = computed(() => cursor.value.getMonth()) // 0-11
const monthLabel = computed(() => `${year.value} 年 ${month.value + 1} 月`)
function shiftMonth(delta: number) {
  cursor.value = new Date(year.value, month.value + delta, 1)
  selected.value = null
}
const atCurrentMonth = computed(() => {
  const now = new Date(todayKey + 'T00:00:00')
  return year.value === now.getFullYear() && month.value === now.getMonth()
})

const pad = (n: number) => String(n).padStart(2, '0')
const keyFor = (day: number) => `${year.value}-${pad(month.value + 1)}-${pad(day)}`

// Calendar grid: leading blanks (week starts Sunday) + day numbers.
const cells = computed(() => {
  const first = new Date(year.value, month.value, 1).getDay() // 0=Sun
  const days = new Date(year.value, month.value + 1, 0).getDate()
  const out: (number | null)[] = []
  for (let i = 0; i < first; i++) out.push(null)
  for (let d = 1; d <= days; d++) out.push(d)
  return out
})
const weekdays = ['日', '一', '二', '三', '四', '五', '六']

// ---- Selected day detail ----
const selected = ref<string | null>(null)
function pick(day: number) {
  const k = keyFor(day)
  selected.value = selected.value === k ? null : k
}
const selectedSummary = computed(() => (selected.value ? summaries.value[selected.value] ?? null : null))
const selectedWeight = computed(() => (selected.value ? weightByDate.value[selected.value] ?? null : null))

// ---- Monthly stats (over logged days in the visible month) ----
const monthStats = computed(() => {
  const prefix = `${year.value}-${pad(month.value + 1)}-`
  const rows = Object.values(summaries.value).filter((s) => s.date.startsWith(prefix) && s.entryCount > 0)
  const n = rows.length
  if (!n) return { days: 0, avgDeficit: 0, avgProtein: 0, avgScore: null as number | null }
  const sum = rows.reduce(
    (a, s) => ({ deficit: a.deficit + deficitOf(s), protein: a.protein + s.protein }),
    { deficit: 0, protein: 0 },
  )
  const scored = rows.filter((s) => s.balanceScore != null)
  return {
    days: n,
    avgDeficit: Math.round(sum.deficit / n),
    avgProtein: Math.round(sum.protein / n),
    avgScore: scored.length ? Math.round(scored.reduce((a, s) => a + (s.balanceScore ?? 0), 0) / scored.length) : null,
  }
})

// ---- Current logging streak (consecutive days up to today) ----
const streak = computed(() => {
  const map = summaries.value
  let n = 0
  const d = new Date(todayKey + 'T00:00:00')
  // If today isn't logged yet, count the streak ending yesterday.
  if (!(map[todayKey]?.entryCount)) d.setDate(d.getDate() - 1)
  for (;;) {
    const k = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
    if (map[k]?.entryCount) { n++; d.setDate(d.getDate() - 1) } else break
  }
  return n
})

function cellClass(day: number) {
  const k = keyFor(day)
  const logged = (summaries.value[k]?.entryCount ?? 0) > 0
  const isToday = k === todayKey
  const isSel = k === selected.value
  return [
    logged ? 'bg-lime-500/15 text-lime-700 dark:text-lime-300 font-semibold' : 'text-ink-500 hover:bg-ink-100',
    isToday ? 'ring-2 ring-brand-400' : '',
    isSel ? 'ring-2 ring-brand-500 bg-brand-500/10' : '',
  ]
}
</script>

<template>
  <section class="card-cute p-5">
    <header class="mb-4 flex items-center justify-between">
      <div class="flex items-center gap-2.5">
        <span class="chip-cute h-8 w-8 bg-brand-500/10 text-brand-600"><CalendarDays class="h-4 w-4" :stroke-width="2" /></span>
        <h3 class="section-title">記錄月曆</h3>
      </div>
      <div class="flex items-center gap-1">
        <button class="btn-icon h-8 w-8 rounded-full bg-ink-100 text-ink-500" @click="shiftMonth(-1)"><ChevronLeft class="h-4 w-4" /></button>
        <span class="min-w-[6.5rem] text-center text-sm font-semibold text-ink-800">{{ monthLabel }}</span>
        <button class="btn-icon h-8 w-8 rounded-full bg-ink-100 text-ink-500 disabled:opacity-40" :disabled="atCurrentMonth" @click="shiftMonth(1)"><ChevronRight class="h-4 w-4" /></button>
      </div>
    </header>

    <!-- Calendar grid -->
    <div class="grid grid-cols-7 gap-1 text-center text-2xs text-ink-400">
      <div v-for="w in weekdays" :key="w" class="py-1">{{ w }}</div>
    </div>
    <div class="mt-1 grid grid-cols-7 gap-1">
      <template v-for="(c, i) in cells" :key="i">
        <div v-if="c === null" />
        <button
          v-else
          class="relative flex aspect-square items-center justify-center rounded-xl text-sm transition-colors"
          :class="cellClass(c)"
          @click="pick(c)"
        >
          {{ c }}
          <span
            v-if="weightByDate[keyFor(c)] != null && !(summaries[keyFor(c)]?.entryCount)"
            class="absolute bottom-1 h-1 w-1 rounded-full bg-emerald-500"
          />
        </button>
      </template>
    </div>

    <div class="mt-3 flex items-center gap-4 text-2xs text-ink-400">
      <span class="flex items-center gap-1"><span class="h-2.5 w-2.5 rounded bg-lime-500/40" /> 有記錄飲食</span>
      <span class="flex items-center gap-1"><span class="h-1.5 w-1.5 rounded-full bg-emerald-500" /> 有量體重</span>
      <span class="flex items-center gap-1"><span class="h-2.5 w-2.5 rounded ring-2 ring-brand-400" /> 今天</span>
    </div>

    <!-- Selected day detail -->
    <div v-if="selected" class="mt-4 rounded-2xl border border-ink-100 bg-ink-50/60 p-4">
      <p class="mb-2 text-sm font-bold text-ink-800">{{ selected }}</p>
      <div v-if="selectedSummary && selectedSummary.entryCount" class="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
        <div><p class="text-ink-400">攝取</p><p class="font-semibold text-ink-800">{{ selectedSummary.intake }} kcal</p></div>
        <div><p class="text-ink-400">熱量赤字</p><p class="font-semibold" :class="deficitOf(selectedSummary) >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'">{{ deficitOf(selectedSummary) >= 0 ? '−' : '+' }}{{ Math.abs(deficitOf(selectedSummary)) }}</p></div>
        <div><p class="text-ink-400">蛋白質</p><p class="font-semibold text-ink-800">{{ selectedSummary.protein }} g</p></div>
        <div><p class="text-ink-400">膳食纖維</p><p class="font-semibold text-ink-800">{{ selectedSummary.fiber }} g</p></div>
      </div>
      <p v-else class="text-xs text-ink-400">這天沒有記錄飲食。</p>
      <div class="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-2xs text-ink-500">
        <span v-if="selectedSummary?.entryCount" class="flex items-center gap-1"><Flame class="h-3 w-3" />{{ selectedSummary.entryCount }} 筆記錄</span>
        <span v-if="selectedSummary?.balanceScore != null" class="flex items-center gap-1"><Sparkles class="h-3 w-3 text-brand-500" />均衡分 {{ selectedSummary.balanceScore }}</span>
        <span v-if="selectedWeight != null" class="flex items-center gap-1"><Scale class="h-3 w-3 text-emerald-500" />{{ selectedWeight }} kg</span>
      </div>
    </div>

    <!-- Monthly stats -->
    <div class="mt-4">
      <h4 class="mb-2 text-xs font-semibold text-ink-500">{{ month + 1 }} 月統計</h4>
      <div class="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div class="rounded-2xl bg-ink-50 p-3 text-center">
          <p class="text-2xs text-ink-400">記錄天數</p>
          <p class="mt-0.5 text-lg font-bold text-ink-900">{{ monthStats.days }}</p>
        </div>
        <div class="rounded-2xl bg-ink-50 p-3 text-center">
          <p class="text-2xs text-ink-400">平均赤字</p>
          <p class="mt-0.5 text-lg font-bold" :class="monthStats.avgDeficit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'">
            {{ monthStats.days ? (monthStats.avgDeficit >= 0 ? '−' : '+') + Math.abs(monthStats.avgDeficit) : '—' }}
          </p>
        </div>
        <div class="rounded-2xl bg-ink-50 p-3 text-center">
          <p class="text-2xs text-ink-400">平均蛋白</p>
          <p class="mt-0.5 text-lg font-bold text-ink-900">{{ monthStats.days ? monthStats.avgProtein + 'g' : '—' }}</p>
        </div>
        <div class="rounded-2xl bg-brand-500/10 p-3 text-center">
          <p class="text-2xs text-ink-400">連續天數</p>
          <p class="mt-0.5 text-lg font-bold text-brand-600 dark:text-brand-300">🔥 {{ streak }}</p>
        </div>
      </div>
      <p v-if="monthStats.avgScore != null" class="mt-2 text-center text-2xs text-ink-400">本月平均 AI 均衡分 {{ monthStats.avgScore }} / 100</p>
    </div>
  </section>
</template>
