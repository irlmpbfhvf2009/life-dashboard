<script setup lang="ts">
// Secondary navigation for the 娛樂 module (命運 + 食物輪盤, plus 遊戲 for players).
// The global sidebar only lists 「娛樂」. 遊戲 (/play) is a separate full-page portal
// and is only shown to users who have the player role.
import { Dices, Utensils, Gamepad2 } from 'lucide-vue-next'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()

interface Item { to: string; label: string; icon: typeof Dices; exact?: boolean }

const ACTIVE = '!bg-brand-500 !text-white'

const items: Item[] = [
  { to: '/fun/fate', label: '命運', icon: Dices },
  { to: '/fun/roulette', label: '食物輪盤', icon: Utensils },
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
    <!-- 遊戲 is a standalone portal (its own page/auth); only players see it. -->
    <RouterLink
      v-if="auth.isPlayer"
      to="/play"
      class="inline-flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm font-medium text-ink-500 transition-colors hover:bg-ink-100"
    >
      <Gamepad2 class="h-3.5 w-3.5" />
      遊戲
    </RouterLink>
  </nav>
</template>
