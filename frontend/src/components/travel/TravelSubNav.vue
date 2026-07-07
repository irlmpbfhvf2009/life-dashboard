<script setup lang="ts">
// Secondary navigation inside the Travel module. The global sidebar only lists
// "旅遊"; this keeps the module's pages organized without polluting the app shell.
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import { Home, Languages, UtensilsCrossed, CalendarRange, Map, ListChecks, Wallet, Calculator, Siren, BookHeart, Share2, MoreHorizontal } from 'lucide-vue-next'

interface Item { to: string; label: string; icon: typeof Home; exact?: boolean }

const ACTIVE = '!bg-gradient-to-r !from-brand-500 !to-violet-600 !text-white shadow-glow'

// Primary items: the ones used on nearly every trip day.
const items: Item[] = [
  { to: '/travel', label: 'tv.nav.home', icon: Home, exact: true },
  { to: '/travel/phrasebook', label: 'tv.nav.phrasebook', icon: Languages },
  { to: '/travel/food', label: 'tv.nav.food', icon: UtensilsCrossed },
  { to: '/travel/itinerary', label: 'tv.nav.itinerary', icon: CalendarRange },
  { to: '/travel/map', label: 'tv.nav.map', icon: Map },
  { to: '/travel/expense', label: 'tv.nav.expense', icon: Wallet },
  { to: '/travel/tools', label: 'tv.nav.tools', icon: Calculator },
]

// Secondary items: set up once per trip or used occasionally — tucked behind
// "更多" so the primary bar doesn't wrap to a busy second/third line.
const moreItems: Item[] = [
  { to: '/travel/packing', label: 'tv.nav.packing', icon: ListChecks },
  { to: '/travel/emergency', label: 'tv.nav.emergency', icon: Siren },
  { to: '/travel/journal', label: 'tv.nav.journal', icon: BookHeart },
  { to: '/travel/share', label: 'tv.nav.share', icon: Share2 },
]

const route = useRoute()
const moreOpen = ref(false)
const isMoreActive = computed(() => moreItems.some((i) => route.path.startsWith(i.to)))
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

    <div class="relative">
      <button
        type="button"
        class="inline-flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm font-medium transition-colors"
        :class="isMoreActive ? ACTIVE : 'text-ink-500 hover:bg-ink-100'"
        @click="moreOpen = !moreOpen"
      >
        <MoreHorizontal class="h-3.5 w-3.5" />
        {{ $t('tv.nav.more') }}
      </button>

      <Transition name="menu">
        <div
          v-if="moreOpen"
          class="absolute left-0 top-11 z-30 w-48 overflow-hidden rounded-2xl border border-ink-200 bg-surface p-1.5 shadow-pop"
        >
          <RouterLink
            v-for="item in moreItems"
            :key="item.to"
            :to="item.to"
            class="nav-item w-full justify-start"
            active-class="text-brand-600 dark:text-brand-300"
            @click="moreOpen = false"
          >
            <component :is="item.icon" class="h-4 w-4" />
            {{ $t(item.label) }}
          </RouterLink>
        </div>
      </Transition>

      <div v-if="moreOpen" class="fixed inset-0 z-20" @click="moreOpen = false" />
    </div>
  </nav>
</template>

<style scoped>
.menu-enter-active,
.menu-leave-active {
  transition: opacity 0.12s ease, transform 0.12s ease;
}
.menu-enter-from,
.menu-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
