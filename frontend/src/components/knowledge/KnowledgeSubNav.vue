<script setup lang="ts">
// Secondary navigation for the 知識 module (筆記 + 書庫). The global sidebar only
// lists 「知識」; this keeps notes and the e-book library under one roof.
import { FileText, BookMarked } from 'lucide-vue-next'

interface Item { to: string; label: string; icon: typeof FileText; exact?: boolean }

const ACTIVE = '!bg-gradient-to-r !from-brand-500 !to-violet-600 !text-white shadow-glow'

const items: Item[] = [
  { to: '/knowledge', label: '筆記', icon: FileText, exact: true },
  { to: '/knowledge/books', label: '書庫', icon: BookMarked },
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
      {{ item.label }}
    </RouterLink>
  </nav>
</template>
