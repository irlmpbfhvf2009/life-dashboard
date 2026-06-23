<script setup lang="ts">
import { reactive, ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Check } from 'lucide-vue-next'
import Creature from './Creature.vue'
import { ANIMALS, animalDef, type AnimalKey } from '@/data/animals'
import { computeMetrics } from '@/utils/healthPlan'
import type { HealthProfile, Gender } from '@/data/health'

const props = defineProps<{ initial?: HealthProfile | null }>()
const emit = defineEmits<{ complete: [profile: HealthProfile] }>()
const { t } = useI18n()

const form = reactive({
  animal: (props.initial?.animal ?? 'otter') as AnimalKey,
  companionName: props.initial?.companionName ?? animalDef('otter').defaultName,
  gender: (props.initial?.gender ?? 'male') as Gender,
  birthday: props.initial?.birthday ?? '1995-01-01',
  heightCm: props.initial?.heightCm ?? 170,
  weightKg: props.initial?.weightKg ?? 70,
  targetWeightKg: props.initial?.targetWeightKg ?? 65,
})

const nameEdited = ref(!!props.initial)
watch(() => form.animal, (a) => { if (!nameEdited.value) form.companionName = animalDef(a).defaultName })

const profile = computed<HealthProfile>(() => ({
  ...form,
  fasting: props.initial?.fasting ?? '16:8',
  pace: props.initial?.pace ?? 'moderate',
  focusAreas: props.initial?.focusAreas ?? ['full'],
  injuries: props.initial?.injuries ?? '',
  accessory: props.initial?.accessory ?? 'none',
  createdAt: props.initial?.createdAt ?? new Date().toISOString(),
}))
const metrics = computed(() => computeMetrics(profile.value))

const valid = computed(() =>
  form.companionName.trim().length > 0 && form.heightCm > 0 && form.weightKg > 0 && form.targetWeightKg > 0 && !!form.birthday,
)
const sel = (active: boolean) =>
  active ? 'border-violet-500 bg-violet-50 text-violet-700 dark:bg-violet-500/10 dark:text-violet-300' : 'border-ink-200 text-ink-700 hover:border-ink-300'
</script>

<template>
  <div class="mx-auto max-w-2xl space-y-4">
    <div class="card-cute p-6">
      <div class="mb-4 flex items-center gap-3">
        <div class="h-14 w-14 shrink-0"><Creature :animal="form.animal" mood="good" /></div>
        <div>
          <h2 class="text-lg font-bold text-ink-900">{{ t('health.setup.title') }}</h2>
          <p class="text-sm text-ink-500">{{ t('health.setup.subtitle') }}</p>
        </div>
      </div>

      <!-- animal + name -->
      <div class="mb-4 grid grid-cols-5 gap-2">
        <button v-for="a in ANIMALS" :key="a.key" class="flex flex-col items-center gap-1 rounded-2xl border p-2" :class="sel(form.animal === a.key)" @click="form.animal = a.key">
          <Creature :animal="a.key" :bob="false" class="h-10 w-10" />
          <span class="text-2xs">{{ t('health.onboarding.animal.' + a.key) }}</span>
        </button>
      </div>
      <div class="mb-4">
        <label class="label">{{ t('health.onboarding.animal.name') }}</label>
        <input v-model="form.companionName" class="input" maxlength="12" @input="nameEdited = true" />
      </div>

      <!-- gender -->
      <div class="mb-4">
        <label class="label">{{ t('health.onboarding.basic.gender') }}</label>
        <div class="grid grid-cols-2 gap-2.5">
          <button class="rounded-2xl border px-4 py-2.5 text-sm" :class="sel(form.gender === 'male')" @click="form.gender = 'male'">♂ {{ t('health.onboarding.basic.male') }}</button>
          <button class="rounded-2xl border px-4 py-2.5 text-sm" :class="sel(form.gender === 'female')" @click="form.gender = 'female'">♀ {{ t('health.onboarding.basic.female') }}</button>
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
