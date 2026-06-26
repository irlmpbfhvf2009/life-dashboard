<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { Menu, Search, LogOut, User, ChevronDown, Sun, Moon } from 'lucide-vue-next'
import { useAuthStore } from '@/stores/auth'
import { useTheme } from '@/composables/useTheme'
import { useCommandPalette } from '@/composables/useCommandPalette'
import LanguageSwitcher from '@/components/ui/LanguageSwitcher.vue'
import NotificationBell from './NotificationBell.vue'

defineEmits<{ 'toggle-sidebar': [] }>()
const auth = useAuthStore()
const router = useRouter()
const menuOpen = ref(false)
const { theme, toggle: toggleTheme } = useTheme()
const cmd = useCommandPalette()

async function logout() {
  menuOpen.value = false
  await auth.logout()
  router.push({ name: 'login' })
}
</script>

<template>
  <header class="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-ink-200 bg-ink-50/80 px-4 backdrop-blur-md lg:px-8">
    <button class="btn-icon lg:hidden" aria-label="開啟選單" @click="$emit('toggle-sidebar')">
      <Menu class="h-5 w-5" />
    </button>

    <!-- Search → opens the ⌘K command palette -->
    <button
      class="hidden w-full max-w-sm items-center gap-2 rounded-xl border border-ink-200 bg-surface px-3.5 py-2 text-sm text-ink-400 shadow-card transition-colors hover:border-ink-300 sm:flex"
      aria-label="搜尋模組與工具"
      @click="cmd.show()"
    >
      <Search class="h-4 w-4" />
      <span>搜尋工具、紀錄、筆記…</span>
      <kbd class="ml-auto rounded-md border border-ink-200 bg-ink-50 px-1.5 py-0.5 text-2xs font-medium text-ink-400">⌘K</kbd>
    </button>
    <!-- Mobile: compact search icon -->
    <button class="btn-icon sm:hidden" aria-label="搜尋" @click="cmd.show()">
      <Search class="h-5 w-5" />
    </button>

    <div class="ml-auto flex items-center gap-1.5">
      <LanguageSwitcher />
      <button
        class="btn-icon"
        :title="theme === 'dark' ? '切換到淺色' : '切換到深色'"
        :aria-label="theme === 'dark' ? '切換到淺色' : '切換到深色'"
        @click="toggleTheme"
      >
        <component :is="theme === 'dark' ? Sun : Moon" class="h-5 w-5" />
      </button>
      <NotificationBell />

      <!-- User menu -->
      <div class="relative">
        <button
          class="flex items-center gap-2 rounded-xl border border-transparent px-1.5 py-1 transition-colors hover:bg-ink-100"
          aria-label="帳號選單"
          @click="menuOpen = !menuOpen"
        >
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
          <ChevronDown class="hidden h-4 w-4 text-ink-400 sm:block" />
        </button>

        <Transition name="menu">
          <div
            v-if="menuOpen"
            class="absolute right-0 top-12 w-56 overflow-hidden rounded-2xl border border-ink-200 bg-surface p-1.5 shadow-pop"
          >
            <div class="px-3 py-2.5">
              <p class="truncate text-sm font-semibold text-ink-800">{{ auth.displayName }}</p>
              <p class="truncate text-xs text-ink-400">{{ auth.email }}</p>
            </div>
            <div class="divider my-1" />
            <button class="nav-item w-full" @click="router.push('/settings'); menuOpen = false">
              <User class="h-4 w-4" /> 個人設定
            </button>
            <button class="nav-item w-full text-rose-600 hover:bg-rose-50 hover:text-rose-700" @click="logout">
              <LogOut class="h-4 w-4" /> 登出
            </button>
          </div>
        </Transition>
      </div>
    </div>

    <div v-if="menuOpen" class="fixed inset-0 z-[-1]" @click="menuOpen = false" />
  </header>
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
