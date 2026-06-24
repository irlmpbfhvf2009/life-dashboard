<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { BookOpen, MessageSquareQuote, GraduationCap, Clapperboard, ChevronRight } from 'lucide-vue-next'
import MasteryProgressBadge from './MasteryProgressBadge.vue'
import type { LearningUnit } from '@/types/english'

const props = defineProps<{ unit: LearningUnit; progress?: number; recommended?: boolean }>()
const router = useRouter()

const ICONS = { vocab: BookOpen, phrase: MessageSquareQuote, grammar: GraduationCap, scenario: Clapperboard }
const ROUTES = {
  vocab: '/ai/english/vocabulary', phrase: '/ai/english/phrases',
  grammar: '/ai/english/grammar', scenario: '/ai/english/scenarios',
}
const pct = computed(() => props.progress ?? 0)
</script>

<template>
  <button
    class="card card-hover flex w-full items-center gap-4 p-4 text-left"
    :class="recommended && 'ring-2 ring-brand-300'"
    @click="router.push(ROUTES[unit.type])"
  >
    <div class="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand-50 text-brand-500 dark:bg-brand-500/10">
      <component :is="ICONS[unit.type]" class="h-5 w-5" />
    </div>
    <div class="min-w-0 flex-1">
      <div class="flex items-center gap-2">
        <h3 class="font-semibold text-ink-800">{{ unit.title }}</h3>
        <span v-if="recommended" class="badge badge-brand">推薦</span>
      </div>
      <div class="mt-1.5 flex items-center gap-2">
        <div class="h-1.5 w-28 overflow-hidden rounded-full bg-ink-100">
          <div class="h-full rounded-full bg-brand-400 transition-all" :style="{ width: pct + '%' }" />
        </div>
        <span class="text-xs text-ink-400">{{ unit.itemCount }} 項</span>
      </div>
    </div>
    <MasteryProgressBadge :status="unit.status" />
    <ChevronRight class="h-4 w-4 shrink-0 text-ink-300" />
  </button>
</template>
