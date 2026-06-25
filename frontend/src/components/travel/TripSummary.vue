<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import { Wallet, ListChecks, CalendarRange } from 'lucide-vue-next'
import SectionCard from '@/components/ui/SectionCard.vue'
import { useTravelWallet, useTravelPacking, useItinerary } from '@/composables/useTravelWallet'

const wallet = useTravelWallet()
const { budget, departDate } = wallet
const packing = useTravelPacking()
const itin = useItinerary()

const nf = new Intl.NumberFormat('en-US')
const fmt = (n: number) => nf.format(Math.round(n))

const packPct = computed(() => {
  const total = packing.items.value.length
  return total ? Math.round((packing.doneCount.value / total) * 100) : 0
})

// Which trip day is "today" (1-based), from the departure date.
const today = new Date()
today.setHours(0, 0, 0, 0)
const tripDay = computed(() => {
  if (!departDate.value) return null
  const dep = new Date(`${departDate.value}T00:00:00`)
  return Math.floor((today.getTime() - dep.getTime()) / 86_400_000) + 1
})
const maxDay = computed(() => itin.byDay.value.reduce((m, g) => Math.max(m, g.day), 0))
const ended = computed(() => tripDay.value != null && maxDay.value > 0 && tripDay.value > maxDay.value)
const planDay = computed(() =>
  tripDay.value == null ? null : Math.min(Math.max(1, tripDay.value), Math.max(1, maxDay.value)),
)
const todayPlan = computed(() => {
  if (planDay.value == null) return []
  const grp = itin.byDay.value.find((g) => g.day === planDay.value)
  return grp ? grp.list.map((x) => x.place) : []
})
</script>

<template>
  <SectionCard :title="$t('tv.summary.title')" :icon="CalendarRange">
    <div class="grid gap-4 sm:grid-cols-3">
      <!-- Budget -->
      <RouterLink to="/travel/expense" class="rounded-xl border border-ink-100 p-4 transition-colors hover:border-brand-200 hover:bg-ink-50/40">
        <div class="mb-2 flex items-center gap-1.5 text-sm font-medium text-ink-600">
          <Wallet class="h-4 w-4 text-amber-500" /> {{ $t('tv.budget.title') }}
        </div>
        <template v-if="budget > 0">
          <p class="text-lg font-bold text-ink-900">NT$ {{ fmt(wallet.totalTwd.value) }}<span class="text-sm font-normal text-ink-400"> / {{ fmt(budget) }}</span></p>
          <div class="mt-2 h-1.5 overflow-hidden rounded-full bg-ink-100">
            <div class="h-full rounded-full" :class="wallet.overBudget.value ? 'bg-rose-500' : 'bg-emerald-500'" :style="{ width: wallet.budgetPct.value + '%' }" />
          </div>
          <p class="mt-1.5 text-xs" :class="wallet.overBudget.value ? 'text-rose-600' : 'text-emerald-600'">
            <template v-if="wallet.overBudget.value">{{ $t('tv.budget.over') }} NT$ {{ fmt(-wallet.remainingTwd.value) }}</template>
            <template v-else>{{ $t('tv.budget.remaining') }} NT$ {{ fmt(wallet.remainingTwd.value) }}</template>
          </p>
        </template>
        <p v-else class="mt-1 text-sm text-ink-400">{{ $t('tv.summary.notSet') }}</p>
      </RouterLink>

      <!-- Packing -->
      <RouterLink to="/travel/packing" class="rounded-xl border border-ink-100 p-4 transition-colors hover:border-brand-200 hover:bg-ink-50/40">
        <div class="mb-2 flex items-center gap-1.5 text-sm font-medium text-ink-600">
          <ListChecks class="h-4 w-4 text-violet-500" /> {{ $t('tv.summary.packing') }}
        </div>
        <template v-if="packing.items.value.length">
          <p class="text-lg font-bold text-ink-900">{{ packing.doneCount.value }}<span class="text-sm font-normal text-ink-400"> / {{ packing.items.value.length }}</span></p>
          <div class="mt-2 h-1.5 overflow-hidden rounded-full bg-ink-100">
            <div class="h-full rounded-full bg-violet-500" :style="{ width: packPct + '%' }" />
          </div>
          <p class="mt-1.5 text-xs text-ink-400">{{ packPct }}%</p>
        </template>
        <p v-else class="mt-1 text-sm text-ink-400">{{ $t('tv.summary.notSet') }}</p>
      </RouterLink>

      <!-- Today's plan -->
      <RouterLink to="/travel/itinerary" class="rounded-xl border border-ink-100 p-4 transition-colors hover:border-brand-200 hover:bg-ink-50/40">
        <div class="mb-2 flex items-center gap-1.5 text-sm font-medium text-ink-600">
          <CalendarRange class="h-4 w-4 text-sky-500" /> {{ $t('tv.summary.today') }}
        </div>
        <p v-if="departDate && !ended && planDay" class="text-sm font-semibold text-ink-800">{{ $t('tv.itinerary.dayLabel', { n: planDay }) }}</p>
        <p v-if="!departDate" class="mt-1 text-sm text-ink-400">{{ $t('tv.summary.setDate') }}</p>
        <p v-else-if="ended" class="mt-1 text-sm text-ink-400">{{ $t('tv.summary.ended') }}</p>
        <ul v-else-if="todayPlan.length" class="mt-1 space-y-0.5">
          <li v-for="(p, i) in todayPlan.slice(0, 3)" :key="i" class="truncate text-sm text-ink-600">· {{ p }}</li>
          <li v-if="todayPlan.length > 3" class="text-xs text-ink-400">+{{ todayPlan.length - 3 }}</li>
        </ul>
        <p v-else class="mt-1 text-sm text-ink-400">{{ $t('tv.summary.noToday') }}</p>
      </RouterLink>
    </div>
  </SectionCard>
</template>
