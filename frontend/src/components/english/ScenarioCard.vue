<script setup lang="ts">
import { computed } from 'vue'
import { Clock, Mic, Target, Play, CheckCircle2 } from 'lucide-vue-next'
import DifficultyBadge from './DifficultyBadge.vue'
import { SCENARIO_LABELS } from '@/data/english'
import type { EnglishScenario } from '@/types/english'

const props = defineProps<{ scenario: EnglishScenario }>()
defineEmits<{ start: [scenario: EnglishScenario] }>()

const categoryLabel = computed(() => SCENARIO_LABELS[props.scenario.category])
const done = computed(() => props.scenario.status === 'DONE')
</script>

<template>
  <article class="card card-hover flex flex-col p-5">
    <div class="mb-3 flex items-start justify-between gap-2">
      <div>
        <p class="text-xs font-medium text-brand-600">{{ categoryLabel }}</p>
        <h3 class="mt-0.5 font-bold text-ink-900">{{ scenario.title }}</h3>
      </div>
      <DifficultyBadge :level="scenario.difficulty" />
    </div>

    <div class="mb-3 flex items-center gap-3 text-xs text-ink-400">
      <span class="inline-flex items-center gap-1"><Clock class="h-3.5 w-3.5" /> {{ scenario.estMinutes }} 分鐘</span>
      <span v-if="scenario.voiceSupported" class="inline-flex items-center gap-1 text-emerald-600"><Mic class="h-3.5 w-3.5" /> 支援語音</span>
    </div>

    <ul class="mb-4 flex-1 space-y-1.5">
      <li v-for="g in scenario.goals.slice(0, 3)" :key="g" class="flex items-start gap-1.5 text-sm text-ink-600">
        <Target class="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-300" /> {{ g }}
      </li>
    </ul>

    <button
      class="btn-primary btn-sm w-full justify-center gap-1.5"
      :class="done && 'btn-secondary'"
      @click="$emit('start', scenario)"
    >
      <CheckCircle2 v-if="done" class="h-3.5 w-3.5" />
      <Play v-else class="h-3.5 w-3.5" />
      {{ done ? '再練一次' : '開始練習' }}
    </button>
  </article>
</template>
