<script setup lang="ts">
import { RouterLink } from 'vue-router'
import { ArrowRight } from 'lucide-vue-next'
import { categoryMeta, type StudioApp } from '@/config/navigation'
import StatusBadge from './StatusBadge.vue'
import { formatDate } from '@/utils/format'

defineProps<{ app: StudioApp }>()
</script>

<template>
  <RouterLink
    :to="app.to"
    class="group flex flex-col rounded-2xl border border-ink-200 bg-surface p-5 shadow-card transition-all hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-card-hover ring-focus"
  >
    <div class="mb-4 flex items-start justify-between">
      <span
        class="flex h-11 w-11 items-center justify-center rounded-xl"
        :class="categoryMeta[app.category].tint"
      >
        <component :is="app.icon" class="h-5 w-5" :stroke-width="2" />
      </span>
      <StatusBadge :status="app.status" />
    </div>

    <h3 class="text-[15px] font-semibold text-ink-800">{{ app.name }}</h3>
    <p class="mt-1 line-clamp-2 text-sm text-ink-500">{{ app.description }}</p>

    <div class="mt-4 flex items-center justify-between border-t border-ink-100 pt-3">
      <span class="text-2xs text-ink-400">
        {{ app.lastUsed ? '最近使用 ' + formatDate(app.lastUsed) : '尚未使用' }}
      </span>
      <span class="inline-flex items-center gap-1 text-xs font-medium text-brand-600 opacity-0 transition-opacity group-hover:opacity-100">
        進入 <ArrowRight class="h-3.5 w-3.5" />
      </span>
    </div>
  </RouterLink>
</template>
