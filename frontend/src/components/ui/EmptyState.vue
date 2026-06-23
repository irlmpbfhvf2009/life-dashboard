<script setup lang="ts">
import type { Component } from 'vue'
import { Inbox } from 'lucide-vue-next'
withDefaults(
  defineProps<{ title?: string; description?: string; icon?: Component }>(),
  { title: '目前還沒有內容', description: '新增第一筆資料開始使用。' },
)
</script>

<template>
  <div class="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-ink-200 bg-ink-50/40 px-6 py-14 text-center">
    <div class="flex h-11 w-11 items-center justify-center rounded-xl bg-surface shadow-card">
      <component :is="icon || Inbox" class="h-5 w-5 text-ink-400" :stroke-width="1.75" />
    </div>
    <div>
      <p class="text-sm font-medium text-ink-700">{{ title }}</p>
      <p class="mt-1 max-w-xs text-xs text-ink-400">{{ description }}</p>
    </div>
    <slot />
  </div>
</template>
