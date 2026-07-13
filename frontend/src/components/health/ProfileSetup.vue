<script setup lang="ts">
import { reactive, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Check, Info } from 'lucide-vue-next'
import { computeMetrics } from '@/utils/healthPlan'
import type { HealthProfile, Gender } from '@/data/health'

const props = defineProps<{ initial?: HealthProfile | null }>()
const emit = defineEmits<{ complete: [profile: HealthProfile] }>()
const { t } = useI18n()

const form = reactive({
  gender: (props.initial?.gender ?? 'male') as Gender,
  birthday: props.initial?.birthday ?? '1995-01-01',
  heightCm: props.initial?.heightCm ?? 170,
  weightKg: props.initial?.weightKg ?? 70,
  targetWeightKg: props.initial?.targetWeightKg ?? 65,
})

const profile = computed<HealthProfile>(() => ({
  ...form,
  fasting: props.initial?.fasting ?? '16:8',
  pace: props.initial?.pace ?? 'moderate',
  focusAreas: props.initial?.focusAreas ?? ['full'],
  injuries: props.initial?.injuries ?? '',
  createdAt: props.initial?.createdAt ?? new Date().toISOString(),
}))
const metrics = computed(() => computeMetrics(profile.value))

const valid = computed(() =>
  form.heightCm > 0 && form.weightKg > 0 && form.targetWeightKg > 0 && !!form.birthday,
)
</script>

<template>
  <div class="mx-auto max-w-2xl space-y-4">
    <div class="card-cute p-6">
      <div class="mb-4">
        <h2 class="text-lg font-bold text-ink-900">{{ t('health.setup.title') }}</h2>
        <p class="text-sm text-ink-500">{{ t('health.setup.subtitle') }}</p>
      </div>

      <p class="mb-4 flex items-start gap-2 rounded-2xl bg-brand-50 px-3 py-2.5 text-xs text-brand-700 dark:bg-brand-500/10 dark:text-brand-300">
        <Info class="mt-0.5 h-4 w-4 shrink-0" />
        <span>性別、生日、身高、體重是計算 BMR、每日消耗與蛋白質建議的依據，填寫越準確，AI 的營養與熱量赤字建議就越貼近你的實際狀況；先隨便填也沒關係，系統會先用這些值抓一個大概，之後可以隨時回來修改。</span>
      </p>

      <!-- gender -->
      <div class="mb-4">
        <label class="label">{{ t('health.onboarding.basic.gender') }}</label>
        <div class="grid grid-cols-2 gap-2.5">
          <button
            class="rounded-2xl border px-4 py-2.5 text-sm"
            :class="form.gender === 'male' ? 'border-violet-500 bg-violet-50 text-violet-700 dark:bg-violet-500/10 dark:text-violet-300' : 'border-ink-200 text-ink-700 hover:border-ink-300'"
            @click="form.gender = 'male'"
          >♂ {{ t('health.onboarding.basic.male') }}</button>
          <button
            class="rounded-2xl border px-4 py-2.5 text-sm"
            :class="form.gender === 'female' ? 'border-violet-500 bg-violet-50 text-violet-700 dark:bg-violet-500/10 dark:text-violet-300' : 'border-ink-200 text-ink-700 hover:border-ink-300'"
            @click="form.gender = 'female'"
          >♀ {{ t('health.onboarding.basic.female') }}</button>
        </div>
      </div>

      <div class="mb-4">
        <label class="label">{{ t('health.onboarding.basic.birthday') }}</label>
        <input v-model="form.birthday" type="date" class="input" />
      </div>
      <div class="grid grid-cols-3 gap-3">
        <div>
          <label class="label">{{ t('health.onboarding.basic.height') }} (cm)</label>
          <input v-model.number="form.heightCm" type="number" min="80" max="250" class="input" />
        </div>
        <div>
          <label class="label">{{ t('health.onboarding.basic.weight') }} (kg)</label>
          <input v-model.number="form.weightKg" type="number" min="25" max="300" step="0.1" class="input" />
        </div>
        <div>
          <label class="label">{{ t('health.onboarding.goal.targetWeight') }} (kg)</label>
          <input v-model.number="form.targetWeightKg" type="number" min="25" max="300" step="0.1" class="input" />
        </div>
      </div>
    </div>

    <!-- Live metrics preview -->
    <div class="card-cute grid grid-cols-2 gap-3 p-5 sm:grid-cols-4">
      <div class="rounded-2xl bg-ink-50 p-3 text-center">
        <p class="text-2xs text-ink-400">{{ t('health.setup.bmi') }}</p>
        <p class="text-lg font-bold text-ink-900">{{ metrics.bmi }}</p>
        <p class="text-2xs text-violet-500">{{ t('health.setup.bmiLabels.' + metrics.bmiLabel) }}</p>
      </div>
      <div class="rounded-2xl bg-ink-50 p-3 text-center">
        <p class="text-2xs text-ink-400">{{ t('health.setup.bmr') }}</p>
        <p class="text-lg font-bold text-ink-900">{{ metrics.bmr }}</p>
        <p class="text-2xs text-ink-400">{{ t('health.units.kcal') }}</p>
      </div>
      <div class="rounded-2xl bg-ink-50 p-3 text-center">
        <p class="text-2xs text-ink-400">{{ t('health.setup.water') }}</p>
        <p class="text-lg font-bold text-ink-900">{{ metrics.recommendWaterMl }}</p>
        <p class="text-2xs text-ink-400">ml</p>
      </div>
      <div class="rounded-2xl bg-ink-50 p-3 text-center">
        <p class="text-2xs text-ink-400">{{ t('health.setup.deficit') }}</p>
        <p class="text-lg font-bold text-emerald-600 dark:text-emerald-400">{{ metrics.dailyDeficit }}</p>
        <p class="text-2xs text-ink-400">{{ t('health.units.kcal') }}</p>
      </div>
    </div>

    <button class="btn-primary w-full justify-center" :disabled="!valid" @click="emit('complete', profile)">
      <Check class="h-4 w-4" /> {{ t('health.setup.finish') }}
    </button>
  </div>
</template>
