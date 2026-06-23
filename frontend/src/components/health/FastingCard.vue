<script setup lang="ts">
import { computed, ref, onMounted, onBeforeUnmount } from 'vue'
import { useI18n } from 'vue-i18n'
import { Timer, Flame, Play, Square, ChevronRight, Check } from 'lucide-vue-next'
import { fastHours, stageForElapsed } from '@/utils/healthPlan'
import { FASTING_PLANS, type FastingKey, type FastingPlan } from '@/data/health'

const props = defineProps<{
  active: boolean
  startTs: number | null
  window: FastingKey
  eatingWindow: string
}>()
defineEmits<{ start: []; end: []; setPlan: [plan: FastingPlan] }>()

const { t } = useI18n()
const showPlans = ref(false)
const currentPlan = computed(() => (props.window === 'none' ? '16:8' : props.window))

const now = ref(Date.now())
let timer: ReturnType<typeof setInterval> | undefined
onMounted(() => { timer = setInterval(() => (now.value = Date.now()), 1000) })
onBeforeUnmount(() => clearInterval(timer))

const totalH = computed(() => fastHours(props.window))
const elapsedH = computed(() =>
  props.active && props.startTs ? (now.value - props.startTs) / 3_600_000 : 0,
)
const progress = computed(() => Math.min(1, Math.max(0, elapsedH.value / totalH.value)))
const stage = computed(() => stageForElapsed(elapsedH.value))

const countdown = computed(() => {
  if (!props.active || !props.startTs) return '00:00:00'
  const remain = Math.max(0, totalH.value * 3_600_000 - (now.value - props.startTs))
  const s = Math.floor(remain / 1000)
  const hh = String(Math.floor(s / 3600)).padStart(2, '0')
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, '0')
  const ss = String(s % 60).padStart(2, '0')
  return `${hh}:${mm}:${ss}`
})

const fmt = (ts: number) => {
  const d = new Date(ts)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}
const startLabel = computed(() => (props.startTs ? fmt(props.startTs) : '--:--'))
const endLabel = computed(() =>
  props.startTs ? fmt(props.startTs + totalH.value * 3_600_000) : '--:--',
)

// Semicircle arc geometry.
const ARC_LEN = Math.PI * 80
const dashOffset = computed(() => ARC_LEN * (1 - progress.value))
const flame = computed(() => ({
  x: 100 - 80 * Math.cos(progress.value * Math.PI),
  y: 100 - 80 * Math.sin(progress.value * Math.PI),
}))
</script>

<template>
  <section class="card-cute p-5">
    <header class="mb-3 flex items-center justify-between">
      <div class="flex items-center gap-2.5">
        <span class="chip-cute h-8 w-8 bg-sky-500/10 text-sky-500"><Timer class="h-4 w-4" :stroke-width="2" /></span>
        <h3 class="section-title">{{ t('health.fasting.title') }}</h3>
      </div>
      <button class="inline-flex items-center gap-1 rounded-full bg-brand-500/10 px-2.5 py-1 text-xs font-semibold text-brand-600 dark:text-brand-300" :disabled="active" @click="showPlans = !showPlans">
        {{ t('health.fasting.plan') }} {{ currentPlan }} <ChevronRight class="h-3.5 w-3.5" :class="showPlans ? 'rotate-90' : ''" />
      </button>
    </header>

    <!-- Plan picker -->
    <div v-if="showPlans" class="mb-3 grid grid-cols-2 gap-2">
      <button v-for="p in FASTING_PLANS" :key="p"
        class="flex items-center justify-between rounded-2xl border px-3 py-2 text-sm"
        :class="p === currentPlan ? 'border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300' : 'border-ink-200 text-ink-700 hover:border-ink-300'"
        @click="$emit('setPlan', p); showPlans = false">
        <span class="font-bold">{{ p }}</span>
        <Check v-if="p === currentPlan" class="h-4 w-4" />
      </button>
    </div>

    <p class="text-xs text-ink-400">
      {{ active ? t('health.fasting.remaining') : t('health.fasting.eatingWindow') }}
    </p>
    <p class="mt-0.5 text-2xl font-bold tracking-tight text-ink-900">
      {{ active ? countdown : eatingWindow }}
    </p>

    <!-- Arc gauge -->
    <div class="mt-2">
      <div class="relative">
        <svg viewBox="0 0 200 116" class="w-full">
          <path d="M20 100 A80 80 0 0 1 180 100" fill="none" stroke="currentColor" class="text-ink-100" stroke-width="11" stroke-linecap="round" />
          <path
            d="M20 100 A80 80 0 0 1 180 100" fill="none" stroke="#38bdf8" stroke-width="11" stroke-linecap="round"
            :stroke-dasharray="ARC_LEN" :stroke-dashoffset="dashOffset"
            style="transition: stroke-dashoffset 0.5s ease"
          />
          <circle v-if="active" :cx="flame.x" :cy="flame.y" r="13" fill="#fff" class="drop-shadow" />
        </svg>
        <div v-if="active" class="absolute" :style="{ left: (flame.x / 200) * 100 + '%', top: (flame.y / 116) * 100 + '%', transform: 'translate(-50%,-50%)' }">
          <Flame class="h-4 w-4 text-orange-500" :fill="'currentColor'" />
        </div>
      </div>
      <div class="-mt-1 flex justify-between px-1 text-2xs text-ink-400">
        <span>{{ active ? startLabel : '' }}</span>
        <span>{{ active ? endLabel : '' }}</span>
      </div>
    </div>

    <!-- Stage + control -->
    <div v-if="active" class="mt-1 rounded-2xl bg-sky-500/5 px-3 py-2 text-center">
      <p class="text-sm font-semibold text-sky-600 dark:text-sky-300">{{ t('health.fasting.stages.' + stage.key) }}</p>
      <p class="text-2xs text-ink-400">{{ t('health.fasting.stageRange', { from: stage.from, to: stage.to }) }}</p>
    </div>

    <button
      v-if="!active"
      class="btn-primary mt-3 w-full justify-center gap-1.5"
      @click="$emit('start')"
    >
      <Play class="h-4 w-4" /> {{ t('health.fasting.start') }}
    </button>
    <button
      v-else
      class="btn-secondary mt-3 w-full justify-center gap-1.5"
      @click="$emit('end')"
    >
      <Square class="h-4 w-4" /> {{ t('health.fasting.end') }}
    </button>
  </section>
</template>
