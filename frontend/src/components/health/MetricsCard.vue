<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Activity, Pencil } from 'lucide-vue-next'
import { computeMetrics } from '@/utils/healthPlan'
import type { HealthProfile } from '@/data/health'

const props = defineProps<{ profile: HealthProfile }>()
defineEmits<{ edit: [] }>()
const { t } = useI18n()
const m = computed(() => computeMetrics(props.profile))

const bmiColor = computed(() =>
  m.value.bmiLabel === 'normal' ? 'text-emerald-600 dark:text-emerald-400'
    : m.value.bmiLabel === 'under' ? 'text-sky-600 dark:text-sky-400'
      : 'text-amber-600 dark:text-amber-400',
)
</script>

<template>
  <section class="card-cute p-5">
    <header class="mb-4 flex items-center justify-between">
      <div class="flex items-center gap-2.5">
        <span class="chip-cute h-8 w-8 bg-violet-500/10 text-violet-500"><Activity class="h-4 w-4" :stroke-width="2" /></span>
        <h3 class="section-title">{{ t('health.setup.metricsTitle') }}</h3>
      </div>
      <button class="btn-ghost btn-sm gap-1.5" @click="$emit('edit')">
        <Pencil class="h-3.5 w-3.5" /> {{ t('health.setup.edit') }}
      </button>
    </header>
    <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <div class="rounded-2xl bg-ink-50 p-3 text-center">
        <p class="text-2xs text-ink-400">{{ t('health.setup.bmi') }}</p>
        <p class="text-lg font-bold" :class="bmiColor">{{ m.bmi }}</p>
        <p class="text-2xs text-ink-400">{{ t('health.setup.bmiLabels.' + m.bmiLabel) }}</p>
      </div>
      <div class="rounded-2xl bg-ink-50 p-3 text-center">
        <p class="text-2xs text-ink-400">{{ t('health.setup.bmr') }}</p>
        <p class="text-lg font-bold text-ink-900">{{ m.bmr }}</p>
        <p class="text-2xs text-ink-400">{{ t('health.units.kcal') }}</p>
      </div>
      <div class="rounded-2xl bg-ink-50 p-3 text-center">
        <p class="text-2xs text-ink-400">{{ t('health.setup.water') }}</p>
        <p class="text-lg font-bold text-ink-900">{{ m.recommendWaterMl }}</p>
        <p class="text-2xs text-ink-400">ml</p>
      </div>
      <div class="rounded-2xl bg-emerald-500/10 p-3 text-center">
        <p class="text-2xs text-ink-400">{{ t('health.setup.deficit') }}</p>
        <p class="text-lg font-bold text-emerald-600 dark:text-emerald-400">{{ m.dailyDeficit }}</p>
        <p class="text-2xs text-ink-400">{{ t('health.units.kcal') }}</p>
      </div>
    </div>
  </section>
</template>
