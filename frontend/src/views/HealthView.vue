<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { PartyPopper, RotateCcw, HeartPulse } from 'lucide-vue-next'
import PageHeader from '@/components/ui/PageHeader.vue'
import ProfileSetup from '@/components/health/ProfileSetup.vue'
import MetricsCard from '@/components/health/MetricsCard.vue'
import WeightPlanCard from '@/components/health/WeightPlanCard.vue'
import FastingCard from '@/components/health/FastingCard.vue'
import FoodCard from '@/components/health/FoodCard.vue'
import HabitChecklist from '@/components/health/HabitChecklist.vue'
import WorkoutLog from '@/components/health/WorkoutLog.vue'
import WaterTracker from '@/components/health/WaterTracker.vue'
import FitnessPanel from '@/components/health/FitnessPanel.vue'
import FastingTrackerPanel from '@/components/health/FastingTrackerPanel.vue'
import { useHealthStore } from '@/composables/useHealthStore'
import { eatingWindow } from '@/utils/healthPlan'
import { workoutPresets, MEAL_SHARE, type HealthProfile, type MealKey, type FastingPlan } from '@/data/health'
import { weightApi } from '@/api'
import type { Exercise } from '@/data/exercises'

const { t } = useI18n()
const store = useHealthStore()

const tabs = ['today', 'fast', 'fitness'] as const
type Tab = (typeof tabs)[number]
const activeTab = ref<Tab>('today')

// A short profile form (生日/性別/身高/體重) gates the dashboard and drives the
// BMI / BMR / water / deficit metrics.
const editing = ref(false)
function onSetupComplete(p: HealthProfile) {
  if (store.isOnboarded.value) store.updateProfile(p)
  else store.onboard(p)
  editing.value = false
}
function resetAll() {
  if (window.confirm(t('health.reset.confirm'))) store.reset()
}

const log = computed(() => store.log.value)
const profile = computed(() => store.profile.value)
const plan = computed(() => store.plan.value)

const habitsDone = computed(() => log.value?.habits.filter((h) => h.done).length ?? 0)
const weekRate = computed(() => {
  const total = log.value?.habits.length ?? 0
  return total ? Math.round((habitsDone.value / total) * 100) : 0
})
const burnedToday = computed(() => log.value?.workouts.reduce((s, w) => s + w.kcal, 0) ?? 0)

// ---- Gamification & coins ----
const toastMsg = ref('')
let toastTimer: ReturnType<typeof setTimeout> | undefined
function flash(msg: string) {
  toastMsg.value = msg
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => (toastMsg.value = ''), 2800)
}
function awardXp(amount: number) {
  const before = log.value?.level ?? 1
  store.update((d) => {
    d.log.xp += amount
    if (d.log.xp < 0) d.log.xp = 0
    while (d.log.xp >= d.log.xpToNext) {
      d.log.xp -= d.log.xpToNext
      d.log.level += 1
      d.log.xpToNext += 20
    }
  })
  const after = log.value?.level ?? 1
  if (after > before && profile.value) flash(`${profile.value.companionName} ${t('health.hero.level')}${after} 🎉`)
}

// ---- Handlers ----
function toggleHabit(id: number) {
  let nowDone = false
  store.update((d) => {
    const h = d.log.habits.find((x) => x.id === id)
    if (!h) return
    h.done = !h.done
    h.streak = h.done ? h.streak + 1 : Math.max(0, h.streak - 1)
    nowDone = h.done
  })
  awardXp(nowDone ? 10 : -10)
}
const todayKey = () => new Date().toISOString().slice(0, 10)
function bumpBurnDay(d: { log: { workoutDays: { date: string; kcal: number }[] } }, kcal: number) {
  const today = todayKey()
  const idx = d.log.workoutDays.findIndex((p) => p.date === today)
  if (idx >= 0) d.log.workoutDays[idx].kcal += kcal
  else d.log.workoutDays.push({ date: today, kcal })
}
function addWorkout(key: string) {
  const p = workoutPresets.find((x) => x.key === key)
  if (!p) return
  const now = new Date()
  const kcal = Math.round(p.kcalPerMin * p.defaultMin)
  store.update((d) => {
    d.log.workouts.unshift({
      id: Date.now(), emoji: p.emoji, key: p.key, minutes: p.defaultMin, kcal,
      time: `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`,
    })
    bumpBurnDay(d, kcal)
  })
  awardXp(15)
}
function addWater(ml: number) {
  store.update((d) => { d.log.water += ml })
  awardXp(2)
}
function addMeal(meal: MealKey) {
  if (!plan.value) return
  const mid = Math.round(plan.value.dailyCalorieTarget * MEAL_SHARE[meal])
  store.update((d) => {
    d.log.meals[meal] += mid
    d.log.consumedKcal += mid
    d.log.macros.protein += Math.round((mid * 0.3) / 4)
    d.log.macros.fat += Math.round((mid * 0.25) / 9)
    d.log.macros.carb += Math.round((mid * 0.45) / 4)
  })
  awardXp(3)
}
function startFasting() {
  store.update((d) => { d.log.fasting = { active: true, startTs: Date.now() } })
}
function endFasting() {
  store.update((d) => { d.log.fasting = { active: false, startTs: null } })
  awardXp(20)
}
function setFastingPlan(p: FastingPlan) {
  store.update((d) => {
    d.profile.fasting = p
    d.plan.fastingWindow = p
    d.plan.eatingWindow = eatingWindow(p)
  })
}

function logWeight(payload: { date: string; kg: number }) {
  store.update((d) => {
    const idx = d.log.weightHistory.findIndex((p) => p.date === payload.date)
    if (idx >= 0) d.log.weightHistory[idx].kg = payload.kg
    else d.log.weightHistory.push({ date: payload.date, kg: payload.kg })
    // "current" tracks the most recent date logged.
    const latest = [...d.log.weightHistory].sort((a, b) => a.date.localeCompare(b.date)).at(-1)
    if (latest) d.log.weightKg = latest.kg
  })
  // Mirror to the backend so the admin panel can see weight history.
  weightApi.create({ date: payload.date, weight: payload.kg }).catch(() => {})
  awardXp(5)
}

// ---- 健身 ----
function addExercise(ex: Exercise) {
  const now = new Date()
  const kcal = Math.round(ex.kcalPerMin * ex.defaultMin)
  store.update((d) => {
    d.log.workouts.unshift({
      id: Date.now(), emoji: ex.emoji, key: `x:${ex.label}`, minutes: ex.defaultMin, kcal,
      time: `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`,
    })
    bumpBurnDay(d, kcal)
  })
  awardXp(15)
}
</script>

<template>
  <!-- Profile gate / edit -->
  <div v-if="!store.isOnboarded.value || editing">
    <PageHeader :icon="HeartPulse" :eyebrow="t('health.eyebrow')" :title="t('health.title')" :subtitle="t('health.subtitle')" />
    <ProfileSetup :initial="editing ? profile : null" @complete="onSetupComplete" />
  </div>

  <div v-else-if="log && profile && plan">
    <PageHeader :icon="HeartPulse" :eyebrow="t('health.eyebrow')" :title="t('health.title')" :subtitle="t('health.subtitle')">
      <template #actions>
        <button class="btn-secondary btn-sm gap-1.5" @click="resetAll">
          <RotateCcw class="h-3.5 w-3.5" /> {{ t('health.reset.button') }}
        </button>
      </template>
    </PageHeader>

    <!-- Tabs -->
    <div class="mb-5 inline-flex rounded-2xl bg-ink-100 p-1">
      <button v-for="tab in tabs" :key="tab"
        class="rounded-xl px-4 py-1.5 text-sm font-medium transition-colors"
        :class="activeTab === tab ? 'bg-surface text-brand-700 shadow-card' : 'text-ink-500 hover:text-ink-700'"
        @click="activeTab = tab">
        {{ t('health.tabs.' + tab) }}
      </button>
    </div>

    <Transition name="toast">
      <div v-if="toastMsg"
        class="mb-5 flex items-center gap-2 rounded-2xl border border-violet-300/60 bg-gradient-to-r from-violet-50 to-indigo-50 px-4 py-3 text-sm font-semibold text-violet-700 shadow-card dark:border-violet-400/30 dark:from-violet-500/10 dark:to-indigo-500/10 dark:text-violet-300">
        <PartyPopper class="h-5 w-5" /> {{ toastMsg }}
      </div>
    </Transition>

    <!-- 今日 -->
    <template v-if="activeTab === 'today'">
      <div class="mb-6 grid gap-4 lg:grid-cols-2">
        <WeightPlanCard
          :current="log.weightKg" :start="log.startWeightKg" :target="profile.targetWeightKg"
          :created-at="profile.createdAt" :history="log.weightHistory" @log="logWeight"
        />
        <MetricsCard :profile="profile" @edit="editing = true" />
      </div>

      <h2 class="mb-3 text-base font-bold text-ink-800">{{ t('health.sections.dailyActions') }}</h2>
      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <FastingCard
          :active="log.fasting.active" :start-ts="log.fasting.startTs"
          :window="plan.fastingWindow" :eating-window="plan.eatingWindow"
          @start="startFasting" @end="endFasting" @set-plan="setFastingPlan"
        />
        <FoodCard
          :daily-target="plan.dailyCalorieTarget" :consumed="log.consumedKcal" :burned="burnedToday"
          :macros="log.macros" :meals="log.meals" @add-meal="addMeal"
        />
        <WaterTracker :done="log.water" :goal="log.waterGoal" @add="addWater" />
        <WorkoutLog :entries="log.workouts" :presets="workoutPresets" @add="addWorkout" />
        <HabitChecklist :items="log.habits" :week-rate="weekRate" @toggle="toggleHabit" />
      </div>
    </template>

    <!-- 斷食 -->
    <FastingTrackerPanel v-else-if="activeTab === 'fast'" />

    <!-- 健身 -->
    <FitnessPanel
      v-else
      :burned-today="burnedToday" :workout-count="log.workouts.length" :injuries="profile.injuries" :days="log.workoutDays"
      @add="addExercise"
    />
  </div>
</template>

<style scoped>
.toast-enter-active, .toast-leave-active { transition: opacity 0.3s ease, transform 0.3s ease; }
.toast-enter-from, .toast-leave-to { opacity: 0; transform: translateY(-6px); }
</style>
