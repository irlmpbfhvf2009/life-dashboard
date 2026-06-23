<script setup lang="ts">
import { ref } from 'vue'
import { RouterView, RouterLink, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const router = useRouter()
const sidebarOpen = ref(false)

const nav = [
  { name: 'dashboard', label: 'Dashboard', icon: '📊' },
  { name: 'todos', label: 'Todos', icon: '✅' },
  { name: 'weights', label: 'Weight', icon: '⚖️' },
  { name: 'foods', label: 'Food', icon: '🍽️' },
  { name: 'expenses', label: 'Expenses', icon: '💰' },
  { name: 'moods', label: 'Mood', icon: '🙂' },
  { name: 'notes', label: 'Notes', icon: '📝' },
  { name: 'settings', label: 'Settings', icon: '⚙️' },
]

async function logout() {
  await auth.logout()
  router.push({ name: 'login' })
}
</script>

<template>
  <div class="min-h-screen lg:flex">
    <!-- Mobile overlay -->
    <div
      v-if="sidebarOpen"
      class="fixed inset-0 z-30 bg-slate-900/40 lg:hidden"
      @click="sidebarOpen = false"
    />

    <!-- Sidebar -->
    <aside
      class="fixed inset-y-0 left-0 z-40 w-64 transform border-r border-slate-200 bg-white transition-transform lg:static lg:translate-x-0"
      :class="sidebarOpen ? 'translate-x-0' : '-translate-x-full'"
    >
      <div class="flex h-16 items-center gap-2 border-b border-slate-200 px-6">
        <span class="text-xl">🌿</span>
        <span class="text-lg font-bold text-slate-800">Life Dashboard</span>
      </div>
      <nav class="flex flex-col gap-1 p-4">
        <RouterLink
          v-for="item in nav"
          :key="item.name"
          :to="{ name: item.name }"
          class="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
          active-class="bg-brand-50 text-brand-700"
          @click="sidebarOpen = false"
        >
          <span>{{ item.icon }}</span>
          {{ item.label }}
        </RouterLink>
      </nav>
    </aside>

    <!-- Main column -->
    <div class="flex min-w-0 flex-1 flex-col">
      <header class="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-slate-200 bg-white/80 px-4 backdrop-blur lg:px-8">
        <button class="text-slate-500 lg:hidden" @click="sidebarOpen = true">☰</button>
        <div class="ml-auto flex items-center gap-3">
          <div class="flex items-center gap-2">
            <img
              v-if="auth.photoUrl"
              :src="auth.photoUrl"
              alt="avatar"
              class="h-8 w-8 rounded-full"
              referrerpolicy="no-referrer"
            />
            <div v-else class="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-700">
              {{ auth.displayName.charAt(0).toUpperCase() }}
            </div>
            <span class="hidden text-sm font-medium text-slate-700 sm:block">{{ auth.displayName }}</span>
          </div>
          <button class="btn-secondary" @click="logout">Sign out</button>
        </div>
      </header>

      <main class="flex-1 p-4 lg:p-8">
        <RouterView />
      </main>
    </div>
  </div>
</template>
