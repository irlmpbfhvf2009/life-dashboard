<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Utensils, Plus, Camera } from 'lucide-vue-next'
import { MEAL_KEYS, MEAL_SHARE, type Macros, type Meals, type MealKey } from '@/data/health'

const props = defineProps<{
  dailyTarget: number
  consumed: number
  burned: number
  macros: Macros
  meals: Meals
}>()
defineEmits<{ addMeal: [meal: MealKey] }>()

const { t } = useI18n()
const remaining = computed(() => Math.round(props.dailyTarget - props.consumed + props.burned))

const targets = computed(() => ({
  protein: Math.round((props.dailyTarget * 0.3) / 4),
  fat: Math.round((props.dailyTarget * 0.25) / 9),
  carb: Math.round((props.dailyTarget * 0.45) / 4),
}))
const pct = (g: number, target: number) => (target > 0 ? Math.min(100, Math.round((g / target) * 100)) : 0)
const macroRows = computed(() => [
  { key: 'protein', g: Math.round(props.macros.protein), target: targets.value.protein, bar: 'bg-emerald-500' },
  { key: 'fat', g: Math.round(props.macros.fat), target: targets.value.fat, bar: 'bg-amber-500' },
  { key: 'carb', g: Math.round(props.macros.carb), target: targets.value.carb, bar: 'bg-sky-500' },
])

const mealRows = computed(() =>
  MEAL_KEYS.map((m) => {
    const mid = props.dailyTarget * MEAL_SHARE[m]
    return {
      key: m,
      lo: Math.round(mid * 0.85),
      hi: Math.round(mid * 1.15),
      logged: Math.round(props.meals[m] || 0),
    }
  }),
)
</script>

<template>
  <section class="card-cute p-5">
    <header class="mb-3 flex items-center justify-between">
      <div class="flex items-center gap-2.5">
        <span class="chip-cute h-8 w-8 bg-orange-500/10 text-orange-500"><Utensils class="h-4 w-4" :stroke-width="2" /></span>
        <h3 class="section-title">{{ t('health.food.title') }}</h3>
      </div>
      <div class="text-right">
        <p class="text-2xs text-ink-400">{{ t('health.food.canEat') }}</p>
        <p class="text-lg font-bold leading-none" :class="remaining >= 0 ? 'text-ink-900' : 'text-rose-500'">
          {{ remaining.toLocaleString() }}<span class="ml-1 text-xs font-medium text-ink-400">{{ t('health.units.kcal') }}</span>
        </p>
      </div>
    </header>

    <!-- Macros -->
    <div class="mb-4 grid grid-cols-3 gap-3">
      <div v-for="r in macroRows" :key="r.key">
        <div class="mb-1 flex items-baseline justify-between">
          <span class="text-2xs text-ink-500">{{ t('health.food.' + r.key) }}</span>
          <span class="text-2xs text-ink-400">{{ r.g }}/{{ r.target }}g</span>
        </div>
        <div class="h-1.5 w-full overflow-hidden rounded-full bg-ink-100">
          <div class="h-full rounded-full transition-all" :class="r.bar" :style="{ width: pct(r.g, r.target) + '%' }" />
        </div>
      </div>
    </div>

    <!-- Meals -->
    <ul class="space-y-1.5">
      <li v-for="m in mealRows" :key="m.key"
        class="flex items-center gap-3 rounded-2xl border border-ink-100 px-3 py-2">
        <div class="min-w-0 flex-1">
          <p class="text-sm font-medium text-ink-800">{{ t('health.food.meals.' + m.key) }}</p>
          <p class="text-2xs text-ink-400">
            <template v-if="m.logged > 0">{{ t('health.food.logged', { n: m.logged }) }}</template>
            <template v-else>{{ t('health.food.recommend', { lo: m.lo, hi: m.hi }) }}</template>
          </p>
        </div>
        <button class="btn-icon h-7 w-7 rounded-full bg-orange-500/10 text-orange-500" :title="t('health.food.add')" @click="$emit('addMeal', m.key)">
          <Plus class="h-4 w-4" />
        </button>
      </li>
    </ul>

    <button class="mt-3 flex w-full items-center justify-center gap-1.5 rounded-2xl border border-dashed border-ink-300 px-3 py-2 text-xs text-ink-400" disabled>
      <Camera class="h-3.5 w-3.5" /> {{ t('health.food.photo') }}
    </button>
  </section>
</template>
