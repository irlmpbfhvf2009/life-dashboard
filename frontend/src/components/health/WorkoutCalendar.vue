<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { CalendarDays, ChevronLeft, ChevronRight, Flame } from 'lucide-vue-next'
import type { BurnPoint } from '@/data/health'

const props = defineProps<{ days: BurnPoint[] }>()
const { t } = useI18n()

const now = new Date()
const year = ref(now.getFullYear())
const month = ref(now.getMonth()) // 0-based

const pad = (n: number) => String(n).padStart(2, '0')
const burnByDate = computed(() => {
  const m: Record<string, number> = {}
  for (const p of props.days) m[p.date] = p.kcal
  return m
})

const weekdays = ['一', '二', '三', '四', '五', '六', '日']
const cells = computed(() => {
  const first = new Date(year.value, month.value, 1)
  const offset = (first.getDay() + 6) % 7 // Monday-start
  const total = new Date(year.value, month.value + 1, 0).getDate()
  const out: { day: number | null; date?: string; kcal?: number }[] = []
  for (let i = 0; i < offset; i++) out.push({ day: null })
  for (let d = 1; d <= total; d++) {
    const date = `${year.value}-${pad(month.value + 1)}-${pad(d)}`
    out.push({ day: d, date, kcal: burnByDate.value[date] })
  }
  return out
})

const todayStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
const activeDays = computed(() => Object.keys(burnByDate.value).filter((d) => burnByDate.value[d] > 0).length)
const monthBurn = computed(() =>
  cells.value.reduce((s, c) => s + (c.kcal ?? 0), 0),
)
const streak = computed(() => {
  let n = 0
  const d = new Date()
  for (;;) {
    const key = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
    if ((burnByDate.value[key] ?? 0) > 0) { n++; d.setDate(d.getDate() - 1) } else break
  }
  return n
})

function shift(delta: number) {
  const m = month.value + delta
  year.value += Math.floor(m / 12)
  month.value = ((m % 12) + 12) % 12
}
</script>

<template>
  <section class="card-cute p-5">
    <header class="mb-3 flex items-center gap-2.5">
      <span class="chip-cute h-8 w-8 bg-orange-500/10 text-orange-500"><CalendarDays class="h-4 w-4" :stroke-width="2" /></span>
      <h3 class="section-title">{{ t('health.calendar.title') }}</h3>
    </header>

    <!-- Summary -->
    <div class="mb-4 grid grid-cols-3 gap-2 text-center">
      <div class="rounded-2xl bg-ink-50 py-2">
        <p class="text-2xs text-ink-400">{{ t('health.calendar.activeDays') }}</p>
        <p class="text-base font-bold text-ink-900">{{ activeDays }}</p>
      </div>
      <div class="rounded-2xl bg-amber-500/10 py-2">
        <p class="text-2xs text-ink-400">{{ t('health.calendar.streak') }}</p>
        <p class="inline-flex items-center gap-0.5 text-base font-bold text-amber-600 dark:text-amber-400"><Flame class="h-3.5 w-3.5" />{{ streak }}</p>
      </div>
      <div class="rounded-2xl bg-ink-50 py-2">
        <p class="text-2xs text-ink-400">{{ t('health.calendar.monthBurn') }}</p>
        <p class="text-base font-bold text-ink-900">{{ monthBurn }}</p>
      </div>
    </div>

    <!-- Month nav -->
    <div class="mb-2 flex items-center justify-between">
      <button class="btn-icon h-7 w-7" @click="shift(-1)"><ChevronLeft class="h-4 w-4" /></button>
      <span class="text-sm font-semibold text-ink-800">{{ year }} / {{ pad(month + 1) }}</span>
      <button class="btn-icon h-7 w-7" @click="shift(1)"><ChevronRight class="h-4 w-4" /></button>
    </div>

    <!-- Grid -->
    <div class="grid grid-cols-7 gap-1 text-center">
      <span v-for="w in weekdays" :key="w" class="py-1 text-2xs text-ink-400">{{ w }}</span>
      <div v-for="(c, i) in cells" :key="i" class="aspect-square rounded-xl p-0.5"
        :class="c.day ? (c.kcal ? 'bg-orange-500/10' : 'bg-ink-50') : ''">
        <template v-if="c.day">
          <p class="text-2xs font-medium" :class="c.date === todayStr ? 'text-brand-600 dark:text-brand-300' : 'text-ink-600'">{{ c.day }}</p>
          <p v-if="c.kcal" class="text-[9px] leading-tight text-orange-600 dark:text-orange-400">{{ c.kcal }}</p>
        </template>
      </div>
    </div>
  </section>
</template>
