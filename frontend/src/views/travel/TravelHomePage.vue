<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import { Plane, Languages, Wallet, Calculator, ArrowRight, CalendarDays, CalendarRange, ListChecks } from 'lucide-vue-next'
import PageHeader from '@/components/ui/PageHeader.vue'
import SectionCard from '@/components/ui/SectionCard.vue'
import DestinationPicker from '@/components/travel/DestinationPicker.vue'
import DestinationWeather from '@/components/travel/DestinationWeather.vue'
import { useTravelWallet } from '@/composables/useTravelWallet'

// Destination + departure date are part of the per-user trip state (synced).
const { destination, departDate } = useTravelWallet()

const daysLeft = computed(() => {
  if (!departDate.value) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const dep = new Date(departDate.value)
  dep.setHours(0, 0, 0, 0)
  return Math.round((dep.getTime() - today.getTime()) / 86_400_000)
})

const tools = [
  { to: '/travel/phrasebook', name: 'tv.nav.phrasebook', desc: 'tv.home.phrasebookDesc', icon: Languages, tint: 'text-brand-600 bg-brand-50' },
  { to: '/travel/itinerary', name: 'tv.nav.itinerary', desc: 'tv.home.itineraryDesc', icon: CalendarRange, tint: 'text-sky-600 bg-sky-50' },
  { to: '/travel/packing', name: 'tv.nav.packing', desc: 'tv.home.packingDesc', icon: ListChecks, tint: 'text-violet-600 bg-violet-50' },
  { to: '/travel/expense', name: 'tv.nav.expense', desc: 'tv.home.expenseDesc', icon: Wallet, tint: 'text-amber-600 bg-amber-50' },
  { to: '/travel/tools', name: 'tv.nav.tools', desc: 'tv.home.toolsDesc', icon: Calculator, tint: 'text-emerald-600 bg-emerald-50' },
]
</script>

<template>
  <div>
    <PageHeader eyebrow="Travel" :title="$t('tv.home.title')" :subtitle="$t('tv.home.subtitle')" />

    <div class="mb-6">
      <DestinationPicker />
    </div>

    <!-- Hero / countdown -->
    <div class="mb-6 overflow-hidden rounded-2xl border border-ink-200 bg-gradient-to-br from-brand-500 to-brand-700 p-6 text-white">
      <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div class="flex items-center gap-2 text-white/80">
            <Plane class="h-4 w-4" />
            <span class="text-sm font-medium">{{ $t('tv.home.nextTrip') }}</span>
          </div>
          <h2 class="mt-1 text-2xl font-bold tracking-tight">{{ destination.flag }} {{ destination.country }}・{{ destination.city }}</h2>
          <p v-if="daysLeft !== null" class="mt-1 text-sm text-white/80">
            <template v-if="daysLeft > 0">{{ $t('tv.home.daysLeft', { n: daysLeft }) }}</template>
            <template v-else-if="daysLeft === 0">{{ $t('tv.home.today') }}</template>
            <template v-else>{{ $t('tv.home.ongoing', { n: -daysLeft }) }}</template>
          </p>
          <p v-else class="mt-1 text-sm text-white/80">{{ $t('tv.home.setDate') }}</p>
        </div>
        <label class="flex items-center gap-2 rounded-xl bg-white/15 px-3 py-2 backdrop-blur">
          <CalendarDays class="h-4 w-4 shrink-0" />
          <input
            v-model="departDate"
            type="date"
            class="bg-transparent text-sm text-white outline-none [color-scheme:dark]"
          />
        </label>
      </div>
    </div>

    <!-- Weather + local time -->
    <div class="mb-6">
      <DestinationWeather />
    </div>

    <!-- Tool entries -->
    <div class="mb-6 grid gap-4 sm:grid-cols-3">
      <RouterLink
        v-for="t in tools"
        :key="t.to"
        :to="t.to"
        class="group flex flex-col rounded-2xl border border-ink-200 bg-surface p-5 shadow-card transition-all hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-card-hover"
      >
        <span class="mb-4 flex h-11 w-11 items-center justify-center rounded-xl" :class="t.tint">
          <component :is="t.icon" class="h-5 w-5" :stroke-width="2" />
        </span>
        <h3 class="text-[15px] font-semibold text-ink-800">{{ $t(t.name) }}</h3>
        <p class="mt-1 text-sm text-ink-500">{{ $t(t.desc) }}</p>
        <span class="mt-4 inline-flex items-center gap-1 text-xs font-medium text-brand-600 opacity-0 transition-opacity group-hover:opacity-100">
          {{ $t('tv.common.enter') }} <ArrowRight class="h-3.5 w-3.5" />
        </span>
      </RouterLink>
    </div>

    <!-- Local cheat sheet (per destination) -->
    <SectionCard :title="$t('tv.home.cheatSheet')" :icon="Plane">
      <ul class="grid gap-x-6 gap-y-4 sm:grid-cols-2">
        <li v-for="tip in destination.cheatSheet" :key="tip.label" class="flex gap-3">
          <span class="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-ink-50 text-ink-400">
            <component :is="tip.icon" class="h-4 w-4" :stroke-width="2" />
          </span>
          <div>
            <p class="text-sm font-semibold text-ink-800">{{ tip.label }}</p>
            <p class="text-sm text-ink-500">{{ tip.value }}</p>
          </div>
        </li>
      </ul>
    </SectionCard>
  </div>
</template>
