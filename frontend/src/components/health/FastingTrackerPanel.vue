<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Play, Square, Flame, Trophy, CalendarDays, Trash2, CheckCircle2, Timer } from 'lucide-vue-next'
import SectionCard from '@/components/ui/SectionCard.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import LoadingState from '@/components/ui/LoadingState.vue'
import ErrorState from '@/components/ui/ErrorState.vue'
import { fastingApi } from '@/api'
import { formatDate } from '@/utils/format'
import type { FastingSession, FastingStats } from '@/types'

const { t } = useI18n()

const PLANS = [
  { label: '16:8', hours: 16 },
  { label: '18:6', hours: 18 },
  { label: '20:4', hours: 20 },
  { label: 'OMAD', hours: 23 },
]

const current = ref<FastingSession | null>(null)
const sessions = ref<FastingSession[]>([])
const stats = ref<FastingStats | null>(null)
const loading = ref(true)
const error = ref('')
const busy = ref(false)
const selectedHours = ref(16)

// Ticks every second so the live timer updates; only meaningful while active.
const nowTs = ref(Date.now())
let timer: ReturnType<typeof setInterval> | undefined

async function load() {
  loading.value = true
  error.value = ''
  try {
    const [cur, recent, st] = await Promise.all([
      fastingApi.current(),
      fastingApi.recent(20),
      fastingApi.stats(),
    ])
    current.value = cur
    sessions.value = recent
    stats.value = st
    if (cur) selectedHours.value = cur.targetHours
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  load()
  timer = setInterval(() => (nowTs.value = Date.now()), 1000)
})
onUnmounted(() => clearInterval(timer))

const elapsedMs = computed(() => {
  if (!current.value) return 0
  return Math.max(0, nowTs.value - new Date(current.value.startAt).getTime())
})
const targetMs = computed(() => (current.value?.targetHours ?? selectedHours.value) * 3_600_000)
const pct = computed(() => Math.min(100, Math.round((elapsedMs.value / targetMs.value) * 100)))
const reached = computed(() => elapsedMs.value >= targetMs.value)

function clock(ms: number): string {
  const total = Math.floor(ms / 1000)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}
const remainingLabel = computed(() => {
  const diff = targetMs.value - elapsedMs.value
  if (diff <= 0) return `已達標 · 超出 ${clock(-diff)}`
  return `距目標還有 ${clock(diff)}`
})

// SVG ring geometry.
const R = 52
const CIRC = 2 * Math.PI * R
const dash = computed(() => `${(pct.value / 100) * CIRC} ${CIRC}`)

function hm(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

async function startFast() {
  busy.value = true
  error.value = ''
  try {
    current.value = await fastingApi.start(selectedHours.value)
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    busy.value = false
  }
}

async function stopFast() {
  busy.value = true
  error.value = ''
  try {
    await fastingApi.stop()
    // Refresh history + stats after closing the session.
    const [recent, st] = await Promise.all([fastingApi.recent(20), fastingApi.stats()])
    current.value = null
    sessions.value = recent
    stats.value = st
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    busy.value = false
  }
}

async function removeSession(s: FastingSession) {
  if (!window.confirm('確定刪除這筆斷食紀錄？')) return
  try {
    await fastingApi.remove(s.id)
    sessions.value = sessions.value.filter((x) => x.id !== s.id)
    stats.value = await fastingApi.stats()
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  }
}
</script>

<template>
  <LoadingState v-if="loading" :label="t('common.loading')" />
  <ErrorState v-else-if="error && !current && !sessions.length && !stats" :message="error" @retry="load" />

  <div v-else class="space-y-6">
    <!-- Stats -->
    <div v-if="stats" class="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <div class="rounded-2xl border border-ink-200 bg-surface p-4 shadow-card">
        <p class="flex items-center gap-1.5 text-2xs text-ink-400"><Flame class="h-3.5 w-3.5 text-orange-500" /> 連續達標</p>
        <p class="mt-1 text-xl font-bold text-ink-800">{{ stats.currentStreakDays }} <span class="text-xs font-medium text-ink-400">天</span></p>
      </div>
      <div class="rounded-2xl border border-ink-200 bg-surface p-4 shadow-card">
        <p class="flex items-center gap-1.5 text-2xs text-ink-400"><CalendarDays class="h-3.5 w-3.5 text-sky-500" /> 本週</p>
        <p class="mt-1 text-xl font-bold text-ink-800">{{ stats.thisWeekCount }} <span class="text-xs font-medium text-ink-400">次</span></p>
      </div>
      <div class="rounded-2xl border border-ink-200 bg-surface p-4 shadow-card">
        <p class="flex items-center gap-1.5 text-2xs text-ink-400"><Trophy class="h-3.5 w-3.5 text-amber-500" /> 最長</p>
        <p class="mt-1 text-xl font-bold text-ink-800">{{ hm(stats.longestMinutes) }}</p>
      </div>
      <div class="rounded-2xl border border-ink-200 bg-surface p-4 shadow-card">
        <p class="flex items-center gap-1.5 text-2xs text-ink-400"><CheckCircle2 class="h-3.5 w-3.5 text-emerald-500" /> 達標 / 總數</p>
        <p class="mt-1 text-xl font-bold text-ink-800">{{ stats.completedSessions }}<span class="text-xs font-medium text-ink-400">/{{ stats.totalSessions }}</span></p>
      </div>
    </div>

    <!-- Timer / control -->
    <SectionCard>
      <div class="flex flex-col items-center gap-5 py-2 sm:flex-row sm:items-center sm:justify-center sm:gap-8">
        <!-- Ring -->
        <div class="relative h-36 w-36 shrink-0">
          <svg class="h-full w-full -rotate-90" viewBox="0 0 120 120">
            <circle cx="60" cy="60" :r="R" fill="none" stroke="currentColor" stroke-width="9" class="text-ink-100" />
            <circle
              cx="60" cy="60" :r="R" fill="none" stroke-width="9" stroke-linecap="round"
              :stroke-dasharray="dash"
              class="transition-all duration-500"
              :class="reached ? 'text-emerald-500' : 'text-brand-500'"
            />
          </svg>
          <div class="absolute inset-0 flex flex-col items-center justify-center">
            <Timer class="mb-1 h-4 w-4 text-ink-300" />
            <span class="font-mono text-lg font-bold tabular-nums text-ink-800">{{ current ? clock(elapsedMs) : '00:00:00' }}</span>
            <span class="text-2xs text-ink-400">{{ current ? pct + '%' : '尚未開始' }}</span>
          </div>
        </div>

        <!-- Control -->
        <div class="w-full max-w-xs">
          <template v-if="current">
            <p class="text-sm font-semibold text-ink-800">斷食進行中 · 目標 {{ current.targetHours }} 小時</p>
            <p class="mt-0.5 text-xs" :class="reached ? 'text-emerald-600' : 'text-ink-400'">{{ remainingLabel }}</p>
            <p class="mt-1 text-2xs text-ink-400">開始於 {{ new Date(current.startAt).toLocaleString() }}</p>
            <button class="btn-primary btn-sm mt-4 w-full justify-center gap-1.5 !bg-rose-500 hover:!bg-rose-600" :disabled="busy" @click="stopFast">
              <Square class="h-3.5 w-3.5" /> 結束斷食
            </button>
          </template>
          <template v-else>
            <p class="mb-2 text-sm font-semibold text-ink-800">選擇斷食方案</p>
            <div class="grid grid-cols-4 gap-2">
              <button
                v-for="p in PLANS" :key="p.label" type="button"
                class="rounded-xl border px-2 py-2 text-center text-xs font-medium transition-colors"
                :class="selectedHours === p.hours ? 'border-brand-400 bg-brand-50 text-brand-700 dark:bg-brand-500/10' : 'border-ink-200 text-ink-500 hover:bg-ink-50'"
                @click="selectedHours = p.hours"
              >
                <span class="block font-semibold">{{ p.label }}</span>
                <span class="block text-2xs text-ink-400">{{ p.hours }}h</span>
              </button>
            </div>
            <button class="btn-primary btn-sm mt-4 w-full justify-center gap-1.5" :disabled="busy" @click="startFast">
              <Play class="h-3.5 w-3.5" /> 開始 {{ selectedHours }} 小時斷食
            </button>
          </template>
          <p v-if="error" class="mt-2 text-xs text-rose-600">{{ error }}</p>
        </div>
      </div>
    </SectionCard>

    <!-- History -->
    <SectionCard>
      <header class="mb-3"><h3 class="section-title">斷食紀錄</h3></header>
      <EmptyState v-if="!sessions.length" title="還沒有紀錄" description="完成第一次斷食後，紀錄會出現在這裡。" />
      <ul v-else class="divide-y divide-ink-100">
        <li v-for="s in sessions" :key="s.id" class="group flex items-center gap-3 py-2.5">
          <span
            class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
            :class="s.completed ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10' : 'bg-ink-100 text-ink-400'"
          >
            <CheckCircle2 v-if="s.completed" class="h-4 w-4" />
            <Timer v-else class="h-4 w-4" />
          </span>
          <div class="min-w-0 flex-1">
            <p class="text-sm font-medium text-ink-800">{{ hm(s.elapsedMinutes) }} <span class="text-xs font-normal text-ink-400">/ 目標 {{ s.targetHours }}h</span></p>
            <p class="text-2xs text-ink-400">{{ formatDate(s.startAt) }}</p>
          </div>
          <span
            v-if="s.completed"
            class="shrink-0 rounded-full bg-emerald-50 px-1.5 py-0.5 text-2xs font-medium text-emerald-600 dark:bg-emerald-500/10"
          >達標</span>
          <button
            class="shrink-0 text-ink-300 opacity-0 transition-opacity hover:text-rose-500 group-hover:opacity-100"
            :aria-label="t('common.delete')"
            @click="removeSession(s)"
          >
            <Trash2 class="h-4 w-4" />
          </button>
        </li>
      </ul>
    </SectionCard>
  </div>
</template>
