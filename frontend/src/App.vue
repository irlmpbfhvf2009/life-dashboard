<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { RouterView } from 'vue-router'
import { Command } from 'lucide-vue-next'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const booting = ref(true)

onMounted(async () => {
  // Ensure the Firebase auth state is resolved before first paint of app chrome.
  if (!auth.initialized) {
    await auth.initAuthListener()
  }
  booting.value = false
})
</script>

<template>
  <!-- Auth boot splash — avoids layout/redirect flicker on first load -->
  <div v-if="booting" class="flex min-h-screen flex-col items-center justify-center gap-4 bg-ink-50">
    <span class="flex h-12 w-12 animate-pulse items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-violet-600 text-white shadow-card">
      <Command class="h-6 w-6" :stroke-width="2.25" />
    </span>
    <p class="text-sm text-ink-400">正在載入工作台…</p>
  </div>

  <RouterView v-else />
</template>
