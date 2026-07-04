<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { RotateCcw, HeartPulse } from 'lucide-vue-next'
import PageHeader from '@/components/ui/PageHeader.vue'
import ProfileSetup from '@/components/health/ProfileSetup.vue'
import MetricsCard from '@/components/health/MetricsCard.vue'
import WeightPlanCard from '@/components/health/WeightPlanCard.vue'
import WaterTracker from '@/components/health/WaterTracker.vue'
import TodayPlanCard from '@/components/health/TodayPlanCard.vue'
import FastingTrackerPanel from '@/components/health/FastingTrackerPanel.vue'
import PlanPanel from '@/components/health/PlanPanel.vue'
import { useHealthStore } from '@/composables/useHealthStore'
import { type HealthProfile } from '@/data/health'
import { weightApi } from '@/api'

const { t } = useI18n()
const store = useHealthStore()

const tabs = ['today', 'plan', 'fast'] as const
type Tab = (typeof tabs)[number]
const activeTab = ref<Tab>('today')

// A short profile form (生日/性別/身高/體重) gates the dashboard and drives the
// BMI / BMR / water metrics.
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

// ---- Handlers ----
function addWater(ml: number) {
  store.update((d) => { d.log.water += ml })
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
  // Mirror to the backend weight rows so the admin panel can see weight history.
  weightApi.create({ date: payload.date, weight: payload.kg }).catch(() => {})
}
function removeWeight(date: string) {
  store.update((d) => {
    d.log.weightHistory = d.log.weightHistory.filter((p) => p.date !== date)
    const latest = [...d.log.weightHistory].sort((a, b) => a.date.localeCompare(b.date)).at(-1)
    if (latest) d.log.weightKg = latest.kg
  })
  // Best-effort: drop matching backend record(s) for that date too.
  weightApi.list()
    .then((rows) => rows.filter((r) => r.date === date).forEach((r) => weightApi.remove(r.id).catch(() => {})))
    .catch(() => {})
}
</script>

<template>
  <!-- Profile gate / edit -->
  <div v-if="!store.isOnboarded.value || editing">
    <PageHeader :icon="HeartPulse" :eyebrow="t('health.eyebrow')" :title="t('health.title')" :subtitle="t('health.subtitle')" />
    <ProfileSetup :initial="editing ? profile : null" @complete="onSetupComplete" />
  </div>

  <div v-else-if="log && profile">
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

    <!-- 今日 -->
    <template v-if="activeTab === 'today'">
      <div class="mb-6 grid gap-4 lg:grid-cols-2">
        <WeightPlanCard
          :current="log.weightKg" :start="log.startWeightKg" :target="profile.targetWeightKg"
          :created-at="profile.createdAt" :history="log.weightHistory" @log="logWeight" @remove="removeWeight"
        />
        <MetricsCard :profile="profile" @edit="editing = true" />
      </div>

      <h2 class="mb-3 text-base font-bold text-ink-800">{{ t('health.sections.dailyActions') }}</h2>
      <div class="grid gap-4 sm:grid-cols-2">
        <TodayPlanCard @go-plan="activeTab = 'plan'" />
        <WaterTracker :done="log.water" :goal="log.waterGoal" @add="addWater" />
      </div>
    </template>

    <!-- 減脂課表 -->
    <PlanPanel v-else-if="activeTab === 'plan'" />

    <!-- 斷食 -->
    <FastingTrackerPanel v-else />
  </div>
</template>
