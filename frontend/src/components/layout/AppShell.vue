<script setup lang="ts">
import { ref } from 'vue'
import { RouterView } from 'vue-router'
import AppSidebar from './AppSidebar.vue'
import AppHeader from './AppHeader.vue'

const sidebarOpen = ref(false)
</script>

<template>
  <div class="min-h-screen lg:flex">
    <!-- Mobile overlay -->
    <Transition name="fade">
      <div
        v-if="sidebarOpen"
        class="fixed inset-0 z-30 bg-ink-900/30 backdrop-blur-sm lg:hidden"
        @click="sidebarOpen = false"
      />
    </Transition>

    <!-- Sidebar -->
    <aside
      class="fixed inset-y-0 left-0 z-40 w-[264px] border-r border-ink-200 transition-transform duration-200 lg:static lg:translate-x-0"
      :class="sidebarOpen ? 'translate-x-0' : '-translate-x-full'"
    >
      <AppSidebar @navigate="sidebarOpen = false" />
    </aside>

    <!-- Main column -->
    <div class="flex min-w-0 flex-1 flex-col">
      <AppHeader @toggle-sidebar="sidebarOpen = true" />
      <main class="flex-1 px-4 py-6 lg:px-8 lg:py-8">
        <div class="relative mx-auto w-full max-w-7xl">
          <RouterView v-slot="{ Component, route }">
            <Transition name="page">
              <component :is="Component" :key="route.path" />
            </Transition>
          </RouterView>
        </div>
      </main>
    </div>
  </div>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
.page-enter-active,
.page-leave-active {
  transition: opacity 0.18s ease, transform 0.18s ease;
}
.page-enter-from {
  opacity: 0;
  transform: translateY(6px);
}
.page-leave-to {
  opacity: 0;
}
/* Take the leaving page out of flow so the entering page doesn't get pushed
   down during the crossfade (we intentionally avoid mode="out-in", which
   deadlocks into a blank screen on rapid route switches). */
.page-leave-active {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
}
</style>
