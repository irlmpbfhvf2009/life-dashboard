<script setup lang="ts">
import { Sun, Dumbbell, UtensilsCrossed, CheckCircle2, Circle, ClipboardList, ArrowRight } from 'lucide-vue-next'
import { usePlan } from '@/composables/usePlan'
import { weekdayZh, shortDate, type PlanDay } from '@/data/fatLossPlan'

// Links the 今日 tab to the 課表 tab: the same four slots, checkable, in sync.
const emit = defineEmits<{ goPlan: [] }>()

const store = usePlan()
const day = store.todayDay

const SLOTS: { key: keyof PlanDay['done']; icon: typeof Sun; label: string; accent: string; field: (d: PlanDay) => string }[] = [
  { key: 'am', icon: Sun, label: '早上運動', accent: 'text-amber-500', field: (d) => (d.amMin > 0 ? `${d.am}・${d.amMin} 分` : '休息') },
  { key: 'meal1', icon: UtensilsCrossed, label: '第一餐', accent: 'text-emerald-500', field: (d) => d.meal1 },
  { key: 'gym', icon: Dumbbell, label: '晚上健身', accent: 'text-violet-500', field: (d) => d.gym },
  { key: 'meal2', icon: UtensilsCrossed, label: '第二餐', accent: 'text-sky-500', field: (d) => d.meal2 },
]
</script>

<template>
  <section class="card-cute p-5">
    <header class="mb-3 flex items-center justify-between">
      <div class="flex items-center gap-2.5">
        <span class="chip-cute h-8 w-8 bg-brand-500/10 text-brand-500"><ClipboardList class="h-4 w-4" :stroke-width="2" /></span>
        <h3 class="section-title">今日課表</h3>
      </div>
      <button class="flex items-center gap-0.5 text-2xs font-medium text-brand-600 hover:underline dark:text-brand-300" @click="emit('goPlan')">
        看完整課表 <ArrowRight class="h-3 w-3" />
      </button>
    </header>

    <template v-if="day">
      <p class="mb-2 text-2xs text-ink-400">{{ shortDate(day.date) }}（{{ weekdayZh(day.date) }}）· 打勾與課表分頁同步</p>
      <ul class="space-y-1">
        <li v-for="s in SLOTS" :key="s.key">
          <button class="flex w-full items-center gap-2.5 rounded-xl p-1.5 text-left transition-colors hover:bg-ink-50" @click="store.toggle(day.date, s.key)">
            <CheckCircle2 v-if="day.done[s.key]" class="h-5 w-5 shrink-0 text-emerald-500" />
            <Circle v-else class="h-5 w-5 shrink-0 text-ink-300" />
            <component :is="s.icon" class="h-3.5 w-3.5 shrink-0" :class="s.accent" />
            <div class="min-w-0 flex-1">
              <span class="text-2xs text-ink-400">{{ s.label }}</span>
              <p class="truncate text-sm text-ink-700" :class="day.done[s.key] && 'text-ink-400 line-through'">{{ s.field(day) }}</p>
            </div>
          </button>
        </li>
      </ul>
    </template>

    <button v-else class="w-full rounded-2xl bg-ink-50 px-3.5 py-4 text-center text-xs text-ink-400 transition-colors hover:bg-ink-100" @click="emit('goPlan')">
      今天不在課表範圍內。到「減脂課表」設定開始日期／週數 →
    </button>
  </section>
</template>
