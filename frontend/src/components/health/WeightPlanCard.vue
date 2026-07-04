<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Scale, Plus, Minus, History, Trash2 } from 'lucide-vue-next'
import TrendChartCard from '@/components/ui/TrendChartCard.vue'
import type { WeightPoint } from '@/data/health'

const props = defineProps<{
  current: number
  start: number
  target: number
  createdAt: string
  history: WeightPoint[]
}>()
const emit = defineEmits<{
  log: [payload: { date: string; kg: number }]
  remove: [date: string]
}>()

const { t } = useI18n()

const dayN = computed(() => {
  const d0 = new Date(props.createdAt)
  if (Number.isNaN(d0.getTime())) return 1
  return Math.max(1, Math.floor((Date.now() - d0.getTime()) / 86400000) + 1)
})
const progress = computed(() => {
  const total = props.start - props.target
  if (total <= 0) return 0
  return Math.min(100, Math.max(0, Math.round(((props.start - props.current) / total) * 100)))
})

// ---- Stats from history ----
const sorted = computed(() => [...props.history].sort((a, b) => a.date.localeCompare(b.date)))
const stats = computed(() => {
  const h = sorted.value
  if (!h.length) return { avg: 0, max: 0, min: 0, daily: 0 }
  const kgs = h.map((p) => p.kg)
  const avg = kgs.reduce((s, k) => s + k, 0) / kgs.length
  const daily = h.length >= 2 ? (h[h.length - 1].kg - h[0].kg) / (h.length - 1) : 0
  return { avg: Math.round(avg * 10) / 10, max: Math.max(...kgs), min: Math.min(...kgs), daily: Math.round(daily * 100) / 100 }
})
const labels = computed(() => sorted.value.map((p) => p.date.slice(5)))
const data = computed(() => sorted.value.map((p) => p.kg))

// ---- Logging ----
const open = ref(false)
const entry = ref(props.current)
const entryDate = ref(new Date().toISOString().slice(0, 10))
function save() {
  if (entry.value > 0) emit('log', { date: entryDate.value, kg: Math.round(entry.value * 10) / 10 })
  open.value = false
}

// ---- History (newest first) with per-record delete ----
const showHistory = ref(false)
const historyDesc = computed(() => [...props.history].sort((a, b) => b.date.localeCompare(a.date)))
function removeEntry(date: string) {
  if (window.confirm(`刪除 ${date} 的體重紀錄？`)) emit('remove', date)
}
</script>

<template>
  <div class="card-cute p-5">
    <div class="mb-4 flex items-center justify-between">
      <div class="flex items-center gap-2.5">
        <span class="chip-cute h-8 w-8 bg-emerald-500/10 text-emerald-500"><Scale class="h-4 w-4" :stroke-width="2" /></span>
        <h3 class="section-title">{{ t('health.weightPlan.title') }}</h3>
      </div>
      <div class="flex items-center gap-2">
        <span class="inline-flex items-center rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-600 dark:text-emerald-300">{{ t('health.weightPlan.progress', { n: progress }) }}</span>
        <button v-if="history.length" class="btn-icon h-7 w-7 rounded-full bg-ink-100 text-ink-500" title="歷史紀錄" @click="showHistory = !showHistory">
          <History class="h-4 w-4" />
        </button>
        <button class="btn-icon h-7 w-7 rounded-full bg-emerald-500/10 text-emerald-600" :title="t('health.weightPlan.log')" @click="open = !open; entry = current">
          <Plus class="h-4 w-4" />
        </button>
      </div>
    </div>

    <!-- Inline logger (any date, so past days can be backfilled) -->
    <div v-if="open" class="mb-4 space-y-2 rounded-2xl bg-ink-50 p-3">
      <input v-model="entryDate" type="date" :max="new Date().toISOString().slice(0, 10)" class="input !py-1.5" />
      <div class="flex items-center justify-center gap-3">
        <button class="btn-icon h-9 w-9 rounded-full bg-surface" @click="entry = Math.round((entry - 0.1) * 10) / 10"><Minus class="h-4 w-4" /></button>
        <input v-model.number="entry" type="number" step="0.1" class="w-24 rounded-xl border border-ink-200 bg-surface px-2 py-1.5 text-center text-lg font-bold text-ink-900" />
        <span class="text-sm text-ink-400">kg</span>
        <button class="btn-icon h-9 w-9 rounded-full bg-surface" @click="entry = Math.round((entry + 0.1) * 10) / 10"><Plus class="h-4 w-4" /></button>
        <button class="btn-primary btn-sm" @click="save">{{ t('common.save') }}</button>
      </div>
    </div>

    <div class="grid grid-cols-4 gap-2 text-center">
      <div class="rounded-2xl bg-ink-50 py-2.5">
        <p class="text-2xs text-ink-400">{{ t('health.weightPlan.current') }}</p>
        <p class="mt-0.5 text-lg font-bold text-ink-900">{{ current }}</p>
      </div>
      <div class="rounded-2xl bg-ink-50 py-2.5">
        <p class="text-2xs text-ink-400">{{ t('health.weightPlan.start') }}</p>
        <p class="mt-0.5 text-lg font-semibold text-ink-500">{{ start }}</p>
      </div>
      <div class="rounded-2xl bg-ink-50 py-2.5">
        <p class="text-2xs text-ink-400">{{ t('health.weightPlan.day') }}</p>
        <p class="mt-0.5 text-lg font-semibold text-ink-700">{{ dayN }}</p>
      </div>
      <div class="rounded-2xl bg-emerald-500/10 py-2.5">
        <p class="text-2xs text-ink-400">{{ t('health.weightPlan.target') }}</p>
        <p class="mt-0.5 text-lg font-bold text-emerald-600 dark:text-emerald-400">{{ target }}</p>
      </div>
    </div>

    <!-- Trend -->
    <div v-if="data.length >= 2" class="mt-4">
      <TrendChartCard :labels="labels" :data="data" color="#10b981" class="!border-0 !p-0 !shadow-none" />
    </div>
    <div v-else class="mt-4 rounded-2xl bg-ink-50 px-3.5 py-3 text-center text-xs text-ink-400">
      {{ t('health.weightPlan.logHint') }}
    </div>

    <!-- Stats -->
    <div class="mt-3 grid grid-cols-3 gap-2 text-center">
      <div>
        <p class="text-2xs text-ink-400">{{ t('health.weightPlan.avg') }}</p>
        <p class="text-sm font-semibold text-ink-800">{{ stats.avg }} kg</p>
      </div>
      <div>
        <p class="text-2xs text-ink-400">{{ t('health.weightPlan.dailyChange') }}</p>
        <p class="text-sm font-semibold" :class="stats.daily <= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'">{{ stats.daily > 0 ? '+' : '' }}{{ stats.daily }} kg</p>
      </div>
      <div>
        <p class="text-2xs text-ink-400">{{ t('health.weightPlan.range') }}</p>
        <p class="text-sm font-semibold text-ink-800">{{ stats.min }}–{{ stats.max }}</p>
      </div>
    </div>

    <!-- History list with per-record delete -->
    <div v-if="showHistory && historyDesc.length" class="mt-4 rounded-2xl bg-ink-50 p-2">
      <ul class="max-h-56 divide-y divide-ink-100 overflow-y-auto">
        <li v-for="p in historyDesc" :key="p.date" class="group flex items-center justify-between px-2 py-2">
          <span class="text-xs text-ink-500">{{ p.date }}</span>
          <span class="ml-auto mr-3 text-sm font-semibold text-ink-800">{{ p.kg }} kg</span>
          <button
            class="text-ink-300 transition-colors hover:text-rose-500"
            :title="t('common.delete')" @click="removeEntry(p.date)"
          >
            <Trash2 class="h-4 w-4" />
          </button>
        </li>
      </ul>
    </div>
  </div>
</template>
