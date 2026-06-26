<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { Settings, Command } from 'lucide-vue-next'
import { navGroups } from '@/config/navigation'
import { useAuthStore } from '@/stores/auth'

defineProps<{ collapsed?: boolean }>()
const emit = defineEmits<{ navigate: [] }>()

const route = useRoute()
const auth = useAuthStore()

function isActive(to: string): boolean {
  return to === '/' ? route.path === '/' : route.path.startsWith(to)
}
const settingsActive = computed(() => route.path.startsWith('/settings'))

// Hide role-gated entries (遊戲 / 管理後台) unless the user has the role.
const visibleGroups = computed(() =>
  navGroups.filter((g) =>
    g.requires === 'player' ? auth.isPlayer
      : g.requires === 'admin' ? auth.isAdmin
        : true,
  ),
)
</script>

<template>
  <div class="flex h-full flex-col bg-ink-50/70 px-4 py-5 backdrop-blur-xl">
    <!-- Brand -->
    <RouterLink to="/" class="mb-6 flex items-center gap-2.5 px-2" @click="emit('navigate')">
      <span class="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-violet-600 text-white shadow-glow">
        <Command class="h-5 w-5" :stroke-width="2.25" />
      </span>
      <span class="leading-tight">
        <span class="block text-sm font-semibold tracking-tight text-ink-800">Intelligence Studio</span>
        <span class="block text-2xs text-ink-400">個人智慧工作台</span>
      </span>
    </RouterLink>

    <!-- Primary nav -->
    <nav class="flex flex-1 flex-col gap-1">
      <p class="eyebrow px-3 pb-1 pt-2">工作區</p>
      <RouterLink
        v-for="g in visibleGroups"
        :key="g.key"
        :to="g.to"
        class="nav-item"
        :class="{ 'nav-item-active': isActive(g.to) }"
        @click="emit('navigate')"
      >
        <component :is="g.icon" class="h-[18px] w-[18px]" :stroke-width="2" />
        {{ g.label }}
      </RouterLink>
    </nav>

    <!-- Settings + user -->
    <div class="mt-2 space-y-1">
      <RouterLink
        to="/settings"
        class="nav-item"
        :class="{ 'nav-item-active': settingsActive }"
        @click="emit('navigate')"
      >
        <Settings class="h-[18px] w-[18px]" :stroke-width="2" />
        設定
      </RouterLink>

      <RouterLink to="/settings" class="mt-2 flex items-center gap-3 rounded-xl border border-ink-200 bg-surface p-2.5 shadow-card" @click="emit('navigate')">
        <img
          v-if="auth.photoUrl"
          :src="auth.photoUrl"
          alt=""
          class="h-8 w-8 rounded-lg object-cover"
          referrerpolicy="no-referrer"
        />
        <span v-else class="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-brand-400 to-violet-500 text-sm font-semibold text-white">
          {{ auth.initials }}
        </span>
        <span class="min-w-0 flex-1 leading-tight">
          <span class="block truncate text-xs font-semibold text-ink-800">{{ auth.displayName }}</span>
          <span class="block truncate text-2xs text-ink-400">{{ auth.email }}</span>
        </span>
      </RouterLink>
    </div>
  </div>
</template>
