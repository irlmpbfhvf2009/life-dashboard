<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Sparkles, Star } from 'lucide-vue-next'
import Creature from './Creature.vue'
import type { AnimalKey } from '@/data/animals'
import type { AccessoryKey } from '@/data/accessories'
import type { OtterMood } from '@/data/health'

const props = defineProps<{
  animal: AnimalKey
  name: string
  mood: OtterMood
  level: number
  xp: number
  xpToNext: number
  greeting: string
  progress: number // weight-plan progress %, shown as "小有起色 N%"
  accessory?: AccessoryKey
}>()

const { t } = useI18n()
const xpPercent = computed(() =>
  props.xpToNext > 0 ? Math.min(100, Math.round((props.xp / props.xpToNext) * 100)) : 0,
)
const moodLine = computed(() => t(`health.moods.${props.mood}`))
</script>

<template>
  <div class="card-cute relative overflow-hidden bg-gradient-to-b from-violet-100 via-indigo-50 to-purple-50 px-6 pb-5 pt-4 dark:from-violet-500/15 dark:via-indigo-500/5 dark:to-purple-500/10">
    <!-- Floating decorations -->
    <div class="pointer-events-none absolute inset-0 overflow-hidden">
      <div class="absolute left-8 top-10 h-10 w-16 rounded-full bg-white/50 dark:bg-white/10" />
      <div class="absolute right-10 top-24 h-12 w-20 rounded-full bg-white/40 dark:bg-white/5" />
      <div class="absolute left-16 bottom-16 h-5 w-5 rounded-full bg-rose-200/70" />
      <div class="absolute right-16 bottom-24 h-3 w-3 rounded-full bg-white/70" />
      <Star class="absolute left-12 top-28 h-4 w-4 text-white" :fill="'currentColor'" :stroke-width="0" />
      <Sparkles class="absolute right-12 top-14 h-5 w-5 text-violet-300" />
      <Sparkles class="absolute left-24 bottom-28 h-3 w-3 text-amber-300" />
    </div>

    <!-- Top row -->
    <div class="relative flex items-start justify-between">
      <p class="rounded-full bg-white/60 px-3 py-1 text-xs font-medium text-ink-600 shadow-sm dark:bg-white/10">{{ greeting }}</p>
      <span class="inline-flex items-center rounded-full bg-violet-500/90 px-2.5 py-1 text-2xs font-bold text-white shadow-sm">
        {{ t('health.hero.level') }}{{ level }}
      </span>
    </div>

    <!-- Mascot -->
    <div class="relative mx-auto mt-1 h-32 w-32">
      <Creature :animal="animal" :mood="mood" :accessory="accessory" class="h-32 w-32" />
    </div>

    <!-- Progress headline -->
    <div class="relative mt-1 text-center">
      <p class="text-xl font-extrabold tracking-tight text-ink-900">
        {{ t('health.weightPlan.progress', { n: progress }) }}
      </p>
      <p class="mt-1 inline-flex items-center gap-1.5 text-sm font-medium text-violet-600 dark:text-violet-300">
        <Sparkles class="h-4 w-4" /> {{ name }} · {{ moodLine }}
      </p>
    </div>

    <!-- XP -->
    <div class="relative mx-auto mt-3 max-w-xs">
      <div class="mb-1 flex items-center justify-between text-2xs font-medium text-ink-400">
        <span>XP</span>
        <span>{{ t('health.hero.xpToNext', { xp: Math.max(0, xpToNext - xp) }) }}</span>
      </div>
      <div class="h-2.5 w-full overflow-hidden rounded-full bg-white/70 shadow-inner dark:bg-white/10">
        <div class="h-full rounded-full bg-gradient-to-r from-violet-400 to-indigo-500 transition-all duration-500"
          :style="{ width: xpPercent + '%' }" />
      </div>
    </div>
  </div>
</template>
