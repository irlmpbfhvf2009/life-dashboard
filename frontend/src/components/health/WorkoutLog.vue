<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Dumbbell, Plus } from 'lucide-vue-next'
import type { WorkoutEntry, WorkoutPreset } from '@/data/health'

const props = defineProps<{ entries: WorkoutEntry[]; presets: WorkoutPreset[] }>()
defineEmits<{ add: [key: string] }>()

const { t } = useI18n()

const totalKcal = computed(() => props.entries.reduce((s, e) => s + e.kcal, 0))
</script>

<template>
  <section class="card-cute p-5">
    <header class="mb-4 flex items-center justify-between">
      <div class="flex items-center gap-2.5">
        <span class="chip-cute h-8 w-8 bg-orange-500/10 text-orange-500"><Dumbbell class="h-4 w-4" :stroke-width="2" /></span>
        <h3 class="section-title">{{ t('health.workout.title') }}</h3>
      </div>
      <div class="text-right">
        <p class="text-2xs text-ink-400">{{ t('health.workout.todayBurn') }}</p>
        <p class="text-sm font-bold text-ink-900">{{ totalKcal }} <span class="font-medium text-ink-400">{{ t('health.units.kcal') }}</span></p>
      </div>
    </header>

    <!-- Quick-add chips -->
    <p class="eyebrow mb-2">{{ t('health.workout.add') }}</p>
    <div class="mb-4 flex flex-wrap gap-2">
      <button
        v-for="p in presets"
        :key="p.key"
        class="inline-flex items-center gap-1.5 rounded-2xl border border-ink-200 bg-surface px-3 py-1.5 text-sm text-ink-700 transition-colors hover:border-orange-300 hover:bg-orange-50 dark:hover:bg-orange-500/10"
        @click="$emit('add', p.key)"
      >
        <span class="text-base leading-none">{{ p.emoji }}</span>
        {{ t('health.workoutNames.' + p.key) }}
        <Plus class="h-3.5 w-3.5 text-ink-400" />
      </button>
    </div>

    <!-- Today's entries -->
    <p class="eyebrow mb-2">{{ t('health.workout.recent') }}</p>
    <ul v-if="entries.length" class="space-y-1.5">
      <li
        v-for="e in entries"
        :key="e.id"
        class="flex items-center gap-3 rounded-2xl border border-ink-100 px-3 py-2"
      >
        <span class="text-lg leading-none">{{ e.emoji }}</span>
        <span class="flex-1 text-sm font-medium text-ink-800">{{ e.key.startsWith('x:') ? e.key.slice(2) : t('health.workoutNames.' + e.key) }}</span>
        <span class="text-xs text-ink-400">{{ e.minutes }} {{ t('health.units.min') }}</span>
        <span class="text-sm font-semibold text-ink-700">{{ e.kcal }} {{ t('health.units.kcal') }}</span>
        <span class="w-10 text-right text-2xs text-ink-300">{{ e.time }}</span>
      </li>
    </ul>
    <p v-else class="rounded-2xl bg-ink-50 px-3.5 py-3 text-center text-sm text-ink-400">
      {{ t('health.workout.empty') }}
    </p>
  </section>
</template>
