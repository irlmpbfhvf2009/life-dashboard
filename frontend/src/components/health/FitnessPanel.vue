<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Dumbbell, Flame, Plus, ShieldAlert } from 'lucide-vue-next'
import WorkoutCalendar from './WorkoutCalendar.vue'
import { EXERCISES, type Exercise } from '@/data/exercises'
import { BODY_PARTS, type BodyPart, type BurnPoint } from '@/data/health'

defineProps<{ burnedToday: number; workoutCount: number; injuries: string; days: BurnPoint[] }>()
defineEmits<{ add: [ex: Exercise] }>()

const { t } = useI18n()

const part = ref<BodyPart | 'all'>('all')
const equip = ref<'all' | 'no' | 'yes'>('all')

const filtered = computed(() =>
  EXERCISES.filter((e) => {
    if (part.value !== 'all' && e.bodyPart !== part.value) return false
    if (equip.value === 'no' && !e.noEquip) return false
    if (equip.value === 'yes' && e.noEquip) return false
    return true
  }),
)

const partChips = computed(() => ['all', ...BODY_PARTS] as (BodyPart | 'all')[])
const chip = (active: boolean) =>
  active
    ? 'border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300'
    : 'border-ink-200 text-ink-600 hover:border-ink-300'
</script>

<template>
  <div class="space-y-5">
    <!-- Summary -->
    <div class="card-cute flex items-center justify-between p-5">
      <div class="flex items-center gap-2.5">
        <span class="chip-cute h-9 w-9 bg-orange-500/10 text-orange-500"><Flame class="h-4 w-4" :stroke-width="2" /></span>
        <div>
          <p class="text-2xs text-ink-400">{{ t('health.workout.todayBurn') }}</p>
          <p class="text-lg font-bold text-ink-900">{{ burnedToday }} <span class="text-xs font-medium text-ink-400">{{ t('health.units.kcal') }}</span></p>
        </div>
      </div>
      <div class="text-right">
        <p class="text-2xs text-ink-400">{{ t('health.fitness.todayCount') }}</p>
        <p class="text-lg font-bold text-ink-900">{{ workoutCount }}</p>
      </div>
    </div>

    <!-- Calendar -->
    <WorkoutCalendar :days="days" />

    <!-- Injury caution -->
    <div v-if="injuries.trim()" class="flex items-center gap-2 rounded-2xl bg-amber-500/10 px-4 py-2.5 text-sm text-amber-700 dark:text-amber-300">
      <ShieldAlert class="h-4 w-4 shrink-0" /> {{ t('health.fitness.injuryNote', { note: injuries }) }}
    </div>

    <!-- Recommended -->
    <section class="card-cute p-5">
      <div class="mb-3 flex items-center gap-2.5">
        <span class="chip-cute h-8 w-8 bg-violet-500/10 text-violet-500"><Dumbbell class="h-4 w-4" :stroke-width="2" /></span>
        <h3 class="section-title">{{ t('health.fitness.recommend') }}</h3>
      </div>

      <!-- Body-part filter -->
      <div class="mb-2 flex flex-wrap gap-1.5">
        <button v-for="p in partChips" :key="p" class="rounded-full border px-3 py-1 text-xs font-medium" :class="chip(part === p)" @click="part = p">
          {{ p === 'all' ? t('health.fitness.all') : t('health.onboarding.training.' + p) }}
        </button>
      </div>
      <!-- Equipment filter -->
      <div class="mb-4 flex flex-wrap gap-1.5">
        <button class="rounded-full border px-3 py-1 text-xs font-medium" :class="chip(equip === 'all')" @click="equip = 'all'">{{ t('health.fitness.all') }}</button>
        <button class="rounded-full border px-3 py-1 text-xs font-medium" :class="chip(equip === 'no')" @click="equip = 'no'">{{ t('health.fitness.noEquip') }}</button>
        <button class="rounded-full border px-3 py-1 text-xs font-medium" :class="chip(equip === 'yes')" @click="equip = 'yes'">{{ t('health.fitness.equip') }}</button>
      </div>

      <ul class="space-y-1.5">
        <li v-for="ex in filtered" :key="ex.id" class="flex items-center gap-3 rounded-2xl border border-ink-100 px-3 py-2">
          <span class="text-lg leading-none">{{ ex.emoji }}</span>
          <div class="min-w-0 flex-1">
            <p class="truncate text-sm font-medium text-ink-800">{{ ex.label }}</p>
            <p class="text-2xs text-ink-400">
              {{ t('health.onboarding.training.' + ex.bodyPart) }} · {{ ex.noEquip ? t('health.fitness.noEquip') : t('health.fitness.equip') }} · ~{{ ex.kcalPerMin * ex.defaultMin }} {{ t('health.units.kcal') }}
            </p>
          </div>
          <button class="btn-secondary btn-sm shrink-0 gap-1" @click="$emit('add', ex)">
            <Plus class="h-3.5 w-3.5" /> {{ t('health.fitness.add') }}
          </button>
        </li>
      </ul>
    </section>
  </div>
</template>
