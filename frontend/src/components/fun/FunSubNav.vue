<script setup lang="ts">
// Secondary navigation for the 娛樂 module (命運 + 食物輪盤 + 遊戲).
// The global sidebar only lists 「娛樂」; 遊戲 is the in-studio arcade page.
import { Dices, Utensils, Gamepad2 } from 'lucide-vue-next'

interface Item { to: string; label: string; icon: typeof Dices; exact?: boolean }

const ACTIVE = '!bg-gradient-to-r !from-brand-500 !to-violet-600 !text-white shadow-glow'

const items: Item[] = [
  { to: '/fun/fate', label: '命運', icon: Dices },
  { to: '/fun/roulette', label: '食物輪盤', icon: Utensils },
  { to: '/fun/games', label: '遊戲', icon: Gamepad2 },
]
</script>

<template>
  <nav class="mb-6 flex flex-wrap items-center gap-x-1 gap-y-2">
    <RouterLink
      v-for="item in items"
      :key="item.to"
      :to="item.to"
      class="inline-flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm font-medium text-ink-500 transition-colors hover:bg-ink-100"
      :active-class="ACTIVE"
    >
      <component :is="item.icon" class="h-3.5 w-3.5" />
      {{ item.label }}
    </RouterLink>
  </nav>
</template>
