<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  CalendarDays, Download, RotateCcw, Eraser, ChevronDown, Info, Sliders,
  Sun, Dumbbell, UtensilsCrossed, CheckCircle2, Circle, Flame, Target, Droplets,
} from 'lucide-vue-next'
import SectionCard from '@/components/ui/SectionCard.vue'
import { usePlan } from '@/composables/usePlan'
import { downloadIcs } from '@/utils/ics'
import {
  weekdayZh, shortDate, weekIndex, WORKOUT_LEGEND, GOAL_TEMPLATES, type PlanDay, type PlanGoal,
} from '@/data/fatLossPlan'

const store = usePlan()
const plan = store.plan

const showHelp = ref(false)
const showLegend = ref(false)
const showRules = ref(false)
const showSettings = ref(false)

// ---- Template settings (goal / start date / weeks) ----
const GOALS: PlanGoal[] = ['cut', 'gain', 'maintain']
const goalSel = ref<PlanGoal>(plan.value?.goal ?? 'cut')
const startSel = ref(plan.value?.startDate ?? '2026-07-02')
const weeksSel = ref(plan.value?.weeks ?? 4)

function applyTemplate() {
  const g = GOAL_TEMPLATES[goalSel.value].label
  if (!window.confirm(`套用「${g}」模板（${startSel.value} 起、${weeksSel.value} 週）？會重新產生課表並清掉現有勾選。`)) return
  store.regenerate(goalSel.value, startSel.value, Math.min(12, Math.max(1, Math.round(weeksSel.value))))
  showSettings.value = false
  flash('已套用新模板')
}

const todayISO = new Date(Date.now() - new Date().getTimezoneOffset() * 60000)
  .toISOString().slice(0, 10)

// Group the plan's days into 第N週 buckets (Mon-start weeks).
const weeks = computed(() => {
  const p = plan.value
  if (!p) return []
  const map = new Map<number, PlanDay[]>()
  for (const d of p.days) {
    const wi = weekIndex(p, d.date)
    if (!map.has(wi)) map.set(wi, [])
    map.get(wi)!.push(d)
  }
  return [...map.entries()].sort((a, b) => a[0] - b[0]).map(([wi, days]) => ({ wi, days }))
})

// Per-day the four checkable slots, in order.
const SLOTS: { key: keyof PlanDay['done']; icon: typeof Sun; label: string; accent: string; field: (d: PlanDay) => string }[] = [
  { key: 'am', icon: Sun, label: '早上運動', accent: 'text-amber-500', field: (d) => (d.amMin > 0 ? `${d.am}・${d.amMin} 分` : '休息') },
  { key: 'meal1', icon: UtensilsCrossed, label: '第一餐 12:00–13:00', accent: 'text-emerald-500', field: (d) => d.meal1 },
  { key: 'gym', icon: Dumbbell, label: '晚上健身', accent: 'text-violet-500', field: (d) => d.gym },
  { key: 'meal2', icon: UtensilsCrossed, label: '第二餐 ~18:30（20:00前吃完）', accent: 'text-sky-500', field: (d) => d.meal2 },
]

function dayDoneCount(d: PlanDay): number {
  return (d.done.am ? 1 : 0) + (d.done.meal1 ? 1 : 0) + (d.done.gym ? 1 : 0) + (d.done.meal2 ? 1 : 0)
}

const flashMsg = ref('')
let flashTimer: ReturnType<typeof setTimeout> | undefined
function flash(m: string) {
  flashMsg.value = m
  clearTimeout(flashTimer)
  flashTimer = setTimeout(() => (flashMsg.value = ''), 3000)
}

function onDownload() {
  if (plan.value) {
    downloadIcs(plan.value)
    flash('已下載 .ics，打開它或到 Google 日曆匯入即可')
  }
}
function onReset() {
  if (window.confirm('重設為預設的 2026/7 減脂計畫？會清掉所有勾選。')) store.resetToDefault()
}
function onClear() {
  if (window.confirm('清除所有完成勾選？（保留課表內容）')) store.clearChecks()
}
</script>

<template>
  <div v-if="plan" class="space-y-6">
    <!-- Summary + actions -->
    <SectionCard>
      <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p class="flex items-center gap-1.5 text-2xs text-ink-400">
            <CalendarDays class="h-3.5 w-3.5 text-brand-500" /> {{ plan.title }}
            <span class="rounded-full bg-brand-500/10 px-1.5 py-0.5 text-brand-600 dark:text-brand-300">{{ GOAL_TEMPLATES[plan.goal].emoji }} {{ GOAL_TEMPLATES[plan.goal].label }}</span>
          </p>
          <p class="mt-0.5 text-sm text-ink-500">
            {{ shortDate(plan.startDate) }} – {{ shortDate(plan.endDate) }}・{{ plan.weeks }} 週
            <span class="mx-1 text-ink-300">·</span>
            <Target class="inline h-3.5 w-3.5 text-rose-500" /> {{ plan.targetLabel }}
          </p>
        </div>
        <div class="flex flex-wrap gap-2">
          <button class="btn-primary btn-sm gap-1.5" @click="onDownload">
            <Download class="h-3.5 w-3.5" /> 下載行事曆 (.ics)
          </button>
          <button class="btn-secondary btn-sm gap-1.5" @click="showSettings = !showSettings">
            <Sliders class="h-3.5 w-3.5" /> 選模板／程度
          </button>
          <button class="btn-secondary btn-sm gap-1.5" @click="onClear">
            <Eraser class="h-3.5 w-3.5" /> 清除勾選
          </button>
          <button class="btn-secondary btn-sm gap-1.5" @click="onReset">
            <RotateCcw class="h-3.5 w-3.5" /> 重設
          </button>
        </div>
      </div>

      <!-- Template / goal settings -->
      <div v-if="showSettings" class="mt-4 rounded-2xl border border-ink-200 bg-ink-50 p-4 dark:bg-ink-100/40">
        <p class="mb-2 text-xs font-semibold text-ink-700">選擇目標模板</p>
        <div class="grid grid-cols-3 gap-2">
          <button
            v-for="g in GOALS" :key="g" type="button"
            class="rounded-xl border px-2 py-2.5 text-center transition-colors"
            :class="goalSel === g ? 'border-brand-400 bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300' : 'border-ink-200 text-ink-500 hover:bg-surface'"
            @click="goalSel = g"
          >
            <span class="block text-lg leading-none">{{ GOAL_TEMPLATES[g].emoji }}</span>
            <span class="mt-1 block text-sm font-semibold">{{ GOAL_TEMPLATES[g].label }}</span>
            <span class="mt-0.5 block text-2xs text-ink-400">{{ GOAL_TEMPLATES[g].calorieLabel }}</span>
          </button>
        </div>
        <div class="mt-3 flex flex-wrap items-end gap-3">
          <label class="text-2xs text-ink-500">開始日期
            <input v-model="startSel" type="date" class="input mt-1 !py-1.5" />
          </label>
          <label class="text-2xs text-ink-500">週數
            <input v-model.number="weeksSel" type="number" min="1" max="12" class="input mt-1 w-20 !py-1.5" />
          </label>
          <button class="btn-primary btn-sm ml-auto" @click="applyTemplate">套用</button>
        </div>
      </div>

      <!-- Progress -->
      <div class="mt-4 grid grid-cols-2 gap-3">
        <div class="rounded-2xl border border-ink-200 bg-surface p-3">
          <p class="text-2xs text-ink-400">整體完成度</p>
          <div class="mt-1.5 h-2 overflow-hidden rounded-full bg-ink-100">
            <div class="h-full rounded-full bg-brand-500 transition-all" :style="{ width: store.progressPct.value + '%' }" />
          </div>
          <p class="mt-1 text-sm font-bold text-ink-800">{{ store.progressPct.value }}%</p>
        </div>
        <div class="rounded-2xl border border-ink-200 bg-surface p-3">
          <p class="flex items-center gap-1 text-2xs text-ink-400"><Flame class="h-3.5 w-3.5 text-orange-500" /> 完美達成日</p>
          <p class="mt-1 text-xl font-bold text-ink-800">{{ store.perfectDays.value }} <span class="text-xs font-medium text-ink-400">/ {{ plan.days.length }} 天</span></p>
        </div>
      </div>

      <Transition name="fade">
        <p v-if="flashMsg" class="mt-3 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">{{ flashMsg }}</p>
      </Transition>

      <!-- Google Calendar import help -->
      <button class="mt-3 flex w-full items-center gap-1.5 text-2xs font-medium text-ink-400 hover:text-ink-600" @click="showHelp = !showHelp">
        <Info class="h-3.5 w-3.5" /> 如何匯入 Google 日曆？
        <ChevronDown class="h-3.5 w-3.5 transition-transform" :class="showHelp && 'rotate-180'" />
      </button>
      <div v-if="showHelp" class="mt-2 rounded-xl bg-ink-50 p-3 text-xs leading-relaxed text-ink-500 dark:bg-ink-100/50">
        1. 點上方「下載行事曆 (.ics)」<br>
        2. 電腦開 <span class="font-medium text-ink-700">calendar.google.com</span> → 右上齒輪 <span class="font-medium text-ink-700">設定</span> → 左側 <span class="font-medium text-ink-700">匯入及匯出</span> → <span class="font-medium text-ink-700">匯入</span><br>
        3. 選剛下載的 .ics 檔（建議先建立新日曆再匯入，方便日後整份清除）→ 匯入<br>
        4. 手機 Google 日曆自動同步，每個時段都會提醒。台灣時區、共 120 個提醒（每天晨跑🏃／第一餐🍱／健身🏋️／第二餐🍽️）。
      </div>
    </SectionCard>

    <!-- Daily fixed rules -->
    <SectionCard>
      <button class="flex w-full items-center gap-2" @click="showRules = !showRules">
        <span class="chip-cute h-8 w-8 bg-brand-500/10 text-brand-500"><Info class="h-4 w-4" :stroke-width="2" /></span>
        <h3 class="section-title flex-1 text-left">每日固定規則</h3>
        <ChevronDown class="h-4 w-4 text-ink-400 transition-transform" :class="showRules && 'rotate-180'" />
      </button>
      <ul v-if="showRules" class="mt-3 space-y-1.5 text-sm text-ink-600">
        <li>💧 起床喝水 500ml，可黑咖啡／無糖茶；全天 <b>2500–3000ml</b></li>
        <li>🍱 168 / 18:6，第一餐 12:00–13:00、第二餐 20:00 前吃完</li>
        <li>🎯 每日熱量 <b>{{ plan.calorieLabel }}</b>、蛋白質 <b>{{ plan.proteinLabel }}</b></li>
        <li>👟 步數 ≥ 10000、😴 睡眠 ≥ 6.5 小時</li>
        <li>⚖️ 早上如廁後量體重，<b>看 7 天平均、不看單日</b></li>
        <li>🚫 禁：奶茶／酒／含糖飲／炸物／宵夜／甜點／泡麵／零食／重鹹滷味／吃到飽</li>
      </ul>
    </SectionCard>

    <!-- Workout legend -->
    <SectionCard>
      <button class="flex w-full items-center gap-2" @click="showLegend = !showLegend">
        <span class="chip-cute h-8 w-8 bg-violet-500/10 text-violet-500"><Dumbbell class="h-4 w-4" :stroke-width="2" /></span>
        <h3 class="section-title flex-1 text-left">健身菜單代號 (A/B/C/D)</h3>
        <ChevronDown class="h-4 w-4 text-ink-400 transition-transform" :class="showLegend && 'rotate-180'" />
      </button>
      <ul v-if="showLegend" class="mt-3 space-y-2 text-sm">
        <li v-for="w in WORKOUT_LEGEND" :key="w.key">
          <p class="font-semibold text-ink-800">{{ w.label }}</p>
          <p class="text-xs text-ink-500">{{ w.detail }}</p>
        </li>
      </ul>
    </SectionCard>

    <!-- The dated plan, grouped by week -->
    <div v-for="wk in weeks" :key="wk.wi" class="space-y-3">
      <h3 class="flex items-center gap-2 px-1 text-sm font-bold text-ink-700">
        <span class="rounded-full bg-brand-500/10 px-2 py-0.5 text-xs text-brand-600 dark:text-brand-300">第 {{ wk.wi + 1 }} 週</span>
      </h3>

      <div
        v-for="d in wk.days" :key="d.date"
        class="rounded-2xl border bg-surface p-4 shadow-card transition-colors"
        :class="d.date === todayISO ? 'border-brand-400 ring-1 ring-brand-300/50' : 'border-ink-200'"
      >
        <!-- Day header -->
        <div class="mb-3 flex items-center justify-between">
          <p class="flex items-center gap-2 text-sm font-bold text-ink-800">
            <span :class="d.date === todayISO ? 'text-brand-600 dark:text-brand-300' : ''">{{ shortDate(d.date) }}（{{ weekdayZh(d.date) }}）</span>
            <span v-if="d.date === todayISO" class="rounded-full bg-brand-500 px-1.5 py-0.5 text-2xs font-medium text-white">今天</span>
          </p>
          <span class="text-2xs font-medium" :class="dayDoneCount(d) === 4 ? 'text-emerald-500' : 'text-ink-400'">{{ dayDoneCount(d) }}/4</span>
        </div>

        <!-- Four checkable slots -->
        <ul class="space-y-1.5">
          <li v-for="s in SLOTS" :key="s.key">
            <button
              class="flex w-full items-start gap-2.5 rounded-xl p-2 text-left transition-colors hover:bg-ink-50"
              @click="store.toggle(d.date, s.key)"
            >
              <CheckCircle2 v-if="d.done[s.key]" class="mt-0.5 h-5 w-5 shrink-0 text-emerald-500" />
              <Circle v-else class="mt-0.5 h-5 w-5 shrink-0 text-ink-300" />
              <div class="min-w-0 flex-1">
                <p class="flex items-center gap-1 text-2xs font-medium text-ink-400">
                  <component :is="s.icon" class="h-3 w-3" :class="s.accent" /> {{ s.label }}
                </p>
                <p class="text-sm text-ink-700" :class="d.done[s.key] && 'text-ink-400 line-through'">{{ s.field(d) }}</p>
              </div>
            </button>
          </li>
        </ul>

        <!-- Note + water -->
        <div class="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-ink-100 pt-2 text-2xs text-ink-400">
          <span class="flex items-center gap-1"><Droplets class="h-3 w-3 text-sky-400" /> {{ d.waterMl }}ml</span>
          <span v-if="d.note" class="flex items-center gap-1"><Info class="h-3 w-3 text-amber-400" /> {{ d.note }}</span>
        </div>
      </div>
    </div>

    <p class="px-1 pb-2 text-2xs leading-relaxed text-ink-400">
      飲食是依你的兩餐規則做的輪替範例，同類蛋白／澱粉可自由替換。安全提醒：168＋每天訓練，<b>蛋白吃滿最重要</b>；體重看 7 天平均，月減約 3–5kg 是合理速度，不要再做 48h 斷食硬衝。
    </p>
  </div>
</template>

<style scoped>
.fade-enter-active, .fade-leave-active { transition: opacity 0.3s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
