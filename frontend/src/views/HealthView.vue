<script setup lang="ts">
import { computed, ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { RotateCcw, HeartPulse } from 'lucide-vue-next'
import PageHeader from '@/components/ui/PageHeader.vue'
import ProfileSetup from '@/components/health/ProfileSetup.vue'
import MetricsCard from '@/components/health/MetricsCard.vue'
import WeightPlanCard from '@/components/health/WeightPlanCard.vue'
import NutritionLogCard from '@/components/health/NutritionLogCard.vue'
import NutritionSummaryCard from '@/components/health/NutritionSummaryCard.vue'
import HistoryCalendarPanel from '@/components/health/HistoryCalendarPanel.vue'
import { useHealthStore } from '@/composables/useHealthStore'
import { type HealthProfile } from '@/data/health'
import { weightApi, aiKeyApi } from '@/api'

const { t } = useI18n()
const store = useHealthStore()

const view = ref<'today' | 'calendar'>('today')

// AI availability, shared by the log card and the summary card.
const aiEnabled = ref(true)
const visionOk = ref(true)
onMounted(async () => {
  try {
    const s = await aiKeyApi.status()
    aiEnabled.value = s.aiAvailable
    visionOk.value = s.vision
  } catch {
    aiEnabled.value = false
  }
})

// A short profile form (生日/性別/身高/體重) gates the dashboard and drives the
// BMI / BMR / calorie-deficit metrics.
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

// ---- Weight logging ----
function logWeight(payload: { date: string; kg: number }) {
  store.update((d) => {
    const idx = d.log.weightHistory.findIndex((p) => p.date === payload.date)
    if (idx >= 0) d.log.weightHistory[idx].kg = payload.kg
    else d.log.weightHistory.push({ date: payload.date, kg: payload.kg })
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

    <!-- 今日營養 / 記錄月曆 -->
    <div class="mb-5 inline-flex rounded-2xl bg-ink-100 p-1">
      <button
        v-for="opt in (['today', 'calendar'] as const)" :key="opt"
        class="rounded-xl px-4 py-1.5 text-sm font-medium transition-colors"
        :class="view === opt ? 'bg-surface text-brand-700 shadow-card' : 'text-ink-500 hover:text-ink-700'"
        @click="view = opt"
      >
        {{ opt === 'today' ? '今日營養' : '記錄月曆' }}
      </button>
    </div>

    <NutritionLogCard v-if="view === 'today'" :profile="profile" :ai-enabled="aiEnabled" :vision-ok="visionOk" />
    <HistoryCalendarPanel v-else :profile="profile" />

    <!-- Body metrics + weight -->
    <div class="mt-6 grid gap-4 lg:grid-cols-2">
      <WeightPlanCard
        :current="log.weightKg" :start="log.startWeightKg" :target="profile.targetWeightKg"
        :created-at="profile.createdAt" :history="log.weightHistory" @log="logWeight" @remove="removeWeight"
      />
      <MetricsCard :profile="profile" @edit="editing = true" />
    </div>

    <!-- 今日總結 + 今日紀錄 -->
    <NutritionSummaryCard v-if="view === 'today'" class="mt-6" :profile="profile" :ai-enabled="aiEnabled" />
  </div>
</template>
