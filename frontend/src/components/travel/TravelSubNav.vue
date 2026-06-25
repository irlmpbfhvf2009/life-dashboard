<script setup lang="ts">
// Secondary navigation inside the Travel module. The global sidebar only lists
// "旅遊"; this keeps the module's pages organized without polluting the app shell.
import { Home, Languages, CalendarRange, Map, ListChecks, Wallet, Calculator } from 'lucide-vue-next'

interface Item { to: string; label: string; icon: typeof Home; exact?: boolean }

const ACTIVE = '!bg-brand-500 !text-white'

const items: Item[] = [
  { to: '/travel', label: 'tv.nav.home', icon: Home, exact: true },
  { to: '/travel/phrasebook', label: 'tv.nav.phrasebook', icon: Languages },
  { to: '/travel/itinerary', label: 'tv.nav.itinerary', icon: CalendarRange },
  { to: '/travel/map', label: 'tv.nav.map', icon: Map },
  { to: '/travel/packing', label: 'tv.nav.packing', icon: ListChecks },
  { to: '/travel/expense', label: 'tv.nav.expense', icon: Wallet },
  { to: '/travel/tools', label: 'tv.nav.tools', icon: Calculator },
]
</script>

<template>
  <nav class="mb-6 flex flex-wrap items-center gap-x-1 gap-y-2">
    <RouterLink
      v-for="item in items"
      :key="item.to"
      :to="item.to"
      class="inline-flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm font-medium text-ink-500 transition-colors hover:bg-ink-100"
      :active-class="item.exact ? '' : ACTIVE"
      :exact-active-class="item.exact ? ACTIVE : ''"
    >
      <component :is="item.icon" class="h-3.5 w-3.5" />
      {{ $t(item.label) }}
    </RouterLink>
  </nav>
</template>
