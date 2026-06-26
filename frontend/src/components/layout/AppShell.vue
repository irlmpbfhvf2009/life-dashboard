<script setup lang="ts">
import { ref } from 'vue'
import { RouterView } from 'vue-router'
import AppSidebar from './AppSidebar.vue'
import AppHeader from './AppHeader.vue'
import ChatWidget from '@/components/chat/ChatWidget.vue'
import CommandPalette from '@/components/ui/CommandPalette.vue'

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
        <div class="mx-auto w-full max-w-7xl">
          <RouterView v-slot="{ Component, route }">
            <!-- No <Transition>: with multi-root views (PageHeader + content as
                 siblings) and rapid route switches, Vue's transition state machine
                 deadlocks and blanks the screen (stuck opacity / orphaned nodes).
                 A plain keyed swap remounts cleanly on every navigation and can
                 never end up invisible. -->
            <component :is="Component" :key="route.path" />
          </RouterView>
        </div>
      </main>
    </div>

    <!-- Floating chat (DMs / groups / public room) — always available in the shell -->
    <ChatWidget />

    <!-- ⌘K command palette — mounted once; opened by the header search or shortcut -->
    <CommandPalette />
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
</style>
