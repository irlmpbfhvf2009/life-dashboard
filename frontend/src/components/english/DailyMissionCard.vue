<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { Target, CheckCircle2, Circle, ChevronRight, BookOpen, MessageSquare, PenLine, Mic, Repeat } from 'lucide-vue-next'
import SectionCard from '@/components/ui/SectionCard.vue'
import type { DailyMission, MissionTask } from '@/types/english'

const props = defineProps<{ mission: DailyMission }>()
const router = useRouter()

const ICONS: Record<MissionTask['kind'], typeof BookOpen> = {
  vocab: BookOpen,
  phrase: MessageSquare,
  conversation: MessageSquare,
  correction: PenLine,
  speaking: Mic,
  review: Repeat,
}

const pct = computed(() =>
  props.mission.totalCount ? Math.round((props.mission.completedCount / props.mission.totalCount) * 100) : 0,
)
</script>

<template>
  <SectionCard>
    <template #action>
      <span class="text-xs font-medium text-ink-400">{{ mission.completedCount }} / {{ mission.totalCount }} 完成</span>
    </template>
    <header class="mb-4 flex items-center gap-2.5">
      <div class="flex h-8 w-8 items-center justify-center rounded-xl bg-brand-50 text-brand-500 dark:bg-brand-500/10">
        <Target class="h-4 w-4" />
      </div>
      <div>
        <h3 class="section-title">今日任務</h3>
        <p class="text-xs text-ink-400">完成今天的學習節奏</p>
      </div>
    </header>

    <!-- Progress -->
    <div class="mb-4 h-2 overflow-hidden rounded-full bg-ink-100">
      <div class="h-full rounded-full bg-gradient-to-r from-brand-400 to-indigo-500 transition-all" :style="{ width: pct + '%' }" />
    </div>

    <ul class="space-y-1.5">
      <li v-for="task in mission.tasks" :key="task.id">
        <button
          class="flex w-full items-center gap-3 rounded-xl border border-transparent px-2 py-2 text-left transition-colors hover:bg-ink-50"
          @click="router.push(task.deepLink)"
        >
          <CheckCircle2 v-if="task.done" class="h-5 w-5 shrink-0 text-emerald-500" />
          <Circle v-else class="h-5 w-5 shrink-0 text-ink-300" />
          <component :is="ICONS[task.kind]" class="h-4 w-4 shrink-0 text-ink-400" />
          <span class="flex-1 text-sm" :class="task.done ? 'text-ink-400 line-through' : 'text-ink-700'">{{ task.label }}</span>
          <span class="shrink-0 text-xs text-ink-400">{{ task.progress }}/{{ task.target }}</span>
          <ChevronRight class="h-4 w-4 shrink-0 text-ink-300" />
        </button>
      </li>
    </ul>
  </SectionCard>
</template>
