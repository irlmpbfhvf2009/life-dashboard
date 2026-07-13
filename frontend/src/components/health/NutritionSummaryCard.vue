<script setup lang="ts">
import { computed, ref } from 'vue'
import { Sparkles, Trash2, Loader2, Flame, Dumbbell, Utensils, RefreshCw, Salad } from 'lucide-vue-next'
import { aiApi } from '@/api'
import { computeMetrics } from '@/utils/healthPlan'
import { useHealthStore } from '@/composables/useHealthStore'
import { useColdStartHint } from '@/composables/useColdStartHint'
import type { FoodEntry, HealthProfile } from '@/data/health'

const props = defineProps<{ profile: HealthProfile; aiEnabled: boolean }>()
const store = useHealthStore()
const { active: slow, start: startSlowTimer, stop: stopSlowTimer } = useColdStartHint()

const metrics = computed(() => computeMetrics(props.profile))
const entries = computed<FoodEntry[]>(() => store.log.value?.entries ?? [])
const review = computed(() => store.log.value?.review ?? null)

// ---- Daily totals derived from the AI-analysed entries ----
const totals = computed(() => {
  let intake = 0, burned = 0, protein = 0, fiber = 0, carbs = 0, fat = 0
  for (const e of entries.value) {
    if (e.kind === 'exercise') { burned += e.calories } else {
      intake += e.calories; protein += e.protein; fiber += e.fiber; carbs += e.carbs; fat += e.fat
    }
  }
  return {
    intake: Math.round(intake), burned: Math.round(burned),
    protein: Math.round(protein), fiber: Math.round(fiber),
    carbs: Math.round(carbs), fat: Math.round(fat),
  }
})
// 熱量赤字 = 每日消耗(TDEE) − 吃進 + 運動消耗
const deficit = computed(() => metrics.value.tdee - totals.value.intake + totals.value.burned)
const proteinTarget = computed(() => Math.round(props.profile.weightKg * 1.6))
const fiberTarget = computed(() => (props.profile.gender === 'male' ? 30 : 25))
const proteinPct = computed(() => Math.min(100, Math.round((totals.value.protein / proteinTarget.value) * 100)))
const fiberPct = computed(() => Math.min(100, Math.round((totals.value.fiber / fiberTarget.value) * 100)))

const error = ref('')

function removeEntry(id: string) {
  store.update((d) => {
    d.log.entries = d.log.entries.filter((x) => x.id !== id)
    d.log.review = null
  })
}

// ---- Daily AI verdict ----
const reviewing = ref(false)
async function runReview() {
  if (reviewing.value || !entries.value.length) return
  reviewing.value = true
  error.value = ''
  startSlowTimer()
  try {
    const r = await aiApi.nutritionReview({
      maintenanceCalories: metrics.value.tdee,
      weightKg: props.profile.weightKg,
      intake: totals.value.intake,
      burned: totals.value.burned,
      protein: totals.value.protein,
      fiber: totals.value.fiber,
      carbs: totals.value.carbs,
      fat: totals.value.fat,
      items: entries.value.filter((e) => e.kind === 'food').map((e) => e.label),
    })
    store.update((d) => { d.log.review = r })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : ''
    error.value = /network error|timeout/i.test(msg)
      ? 'AI 回應時間過長或網路不穩，請稍後再試一次。'
      : (msg || 'AI 分析失敗，請稍後再試')
  } finally {
    reviewing.value = false
    stopSlowTimer()
  }
}

const scoreColor = computed(() => {
  const s = review.value?.balanceScore ?? 0
  return s >= 75 ? 'text-emerald-500' : s >= 50 ? 'text-amber-500' : 'text-rose-500'
})
</script>

<template>
  <div class="space-y-4">
    <!-- Daily summary -->
    <section v-if="entries.length" class="card-cute p-5">
      <h3 class="section-title mb-4">今日總結</h3>
      <div class="grid grid-cols-3 gap-3">
        <div class="rounded-2xl bg-ink-50 p-3 text-center">
          <p class="text-2xs text-ink-400">攝取熱量</p>
          <p class="mt-0.5 text-lg font-bold text-ink-900">{{ totals.intake }}</p>
          <p class="text-2xs text-ink-400">kcal</p>
        </div>
        <div class="rounded-2xl bg-ink-50 p-3 text-center">
          <p class="text-2xs text-ink-400">運動消耗</p>
          <p class="mt-0.5 text-lg font-bold text-orange-500">{{ totals.burned }}</p>
          <p class="text-2xs text-ink-400">kcal</p>
        </div>
        <div class="rounded-2xl p-3 text-center" :class="deficit >= 0 ? 'bg-emerald-500/10' : 'bg-rose-500/10'">
          <p class="text-2xs text-ink-400">熱量赤字</p>
          <p class="mt-0.5 text-lg font-bold" :class="deficit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'">
            {{ deficit >= 0 ? '−' : '+' }}{{ Math.abs(deficit) }}
          </p>
          <p class="text-2xs text-ink-400">每日消耗 {{ metrics.tdee }}</p>
        </div>
      </div>

      <!-- Macro progress -->
      <div class="mt-4 space-y-3">
        <div>
          <div class="mb-1 flex items-baseline justify-between text-xs">
            <span class="font-medium text-ink-700">蛋白質</span>
            <span class="text-ink-400">{{ totals.protein }} / {{ proteinTarget }} g</span>
          </div>
          <div class="h-2 overflow-hidden rounded-full bg-ink-100">
            <div class="h-full rounded-full bg-violet-500 transition-all" :style="{ width: proteinPct + '%' }" />
          </div>
        </div>
        <div>
          <div class="mb-1 flex items-baseline justify-between text-xs">
            <span class="font-medium text-ink-700">膳食纖維</span>
            <span class="text-ink-400">{{ totals.fiber }} / {{ fiberTarget }} g</span>
          </div>
          <div class="h-2 overflow-hidden rounded-full bg-ink-100">
            <div class="h-full rounded-full bg-lime-500 transition-all" :style="{ width: fiberPct + '%' }" />
          </div>
        </div>
        <div class="flex gap-4 text-2xs text-ink-400">
          <span>碳水 {{ totals.carbs }} g</span>
          <span>脂肪 {{ totals.fat }} g</span>
        </div>
      </div>

      <!-- AI verdict -->
      <div class="mt-4 rounded-2xl border border-ink-100 bg-ink-50/60 p-4">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <Sparkles class="h-4 w-4 text-brand-500" />
            <span class="text-sm font-bold text-ink-800">AI 今日總評</span>
          </div>
          <button class="btn-ghost btn-sm gap-1.5" :disabled="reviewing || !aiEnabled" @click="runReview">
            <Loader2 v-if="reviewing" class="h-3.5 w-3.5 animate-spin" />
            <RefreshCw v-else class="h-3.5 w-3.5" />
            {{ reviewing && slow ? '啟動中…' : (review ? '重新分析' : '分析今天') }}
          </button>
        </div>
        <p v-if="reviewing && slow" class="mt-2 text-xs text-ink-400">伺服器閒置一陣子後會休眠，喚醒可能需要 20〜30 秒，請稍候…</p>

        <div v-if="review" class="mt-3 space-y-3">
          <div class="flex items-center gap-3">
            <div class="text-center">
              <p class="text-3xl font-extrabold leading-none" :class="scoreColor">{{ review.balanceScore }}</p>
              <p class="text-2xs text-ink-400">均衡分</p>
            </div>
            <p class="text-sm text-ink-700">{{ review.verdict }}</p>
          </div>

          <div v-if="review.lacking.length">
            <p class="mb-1 text-xs font-semibold text-ink-500">今天可能缺的營養</p>
            <ul class="space-y-1">
              <li v-for="g in review.lacking" :key="g.nutrient" class="flex gap-2 text-xs text-ink-600">
                <span class="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" />
                <span><b class="text-ink-800">{{ g.nutrient }}</b> — {{ g.note }}</span>
              </li>
            </ul>
          </div>

          <div v-if="review.suggestions.length">
            <p class="mb-1 text-xs font-semibold text-ink-500">建議補吃</p>
            <div class="flex flex-wrap gap-1.5">
              <span v-for="s in review.suggestions" :key="s" class="rounded-full bg-lime-500/10 px-2.5 py-1 text-xs text-lime-700 dark:text-lime-300">{{ s }}</span>
            </div>
          </div>

          <p v-if="review.calorieNote" class="rounded-xl bg-ink-100/60 px-3 py-2 text-xs text-ink-600">🔥 {{ review.calorieNote }}</p>
        </div>
        <p v-else class="mt-2 text-xs text-ink-400">記錄完今天吃的東西後，點「分析今天」讓 AI 看看營養夠不夠均衡。</p>
        <p v-if="error" class="mt-2 text-xs text-rose-500">{{ error }}</p>
      </div>
    </section>

    <!-- Entry list -->
    <section v-if="entries.length" class="card-cute p-5">
      <h3 class="section-title mb-3">今日紀錄 ({{ entries.length }})</h3>
      <ul class="space-y-2">
        <li v-for="e in [...entries].reverse()" :key="e.id" class="group flex items-start gap-3 rounded-2xl bg-ink-50 p-3">
          <span class="chip-cute mt-0.5 h-8 w-8 shrink-0" :class="e.kind === 'exercise' ? 'bg-orange-500/10 text-orange-500' : 'bg-lime-500/10 text-lime-600'">
            <Dumbbell v-if="e.kind === 'exercise'" class="h-4 w-4" />
            <Utensils v-else class="h-4 w-4" />
          </span>
          <div class="min-w-0 flex-1">
            <div class="flex items-baseline gap-2">
              <p class="truncate text-sm font-semibold text-ink-800">{{ e.label }}</p>
              <span class="text-2xs text-ink-400">{{ e.time }}</span>
            </div>
            <div class="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-2xs text-ink-500">
              <span class="inline-flex items-center gap-0.5 font-medium" :class="e.kind === 'exercise' ? 'text-orange-500' : 'text-ink-700'">
                <Flame class="h-3 w-3" />{{ e.kind === 'exercise' ? '−' : '' }}{{ e.calories }} kcal
              </span>
              <template v-if="e.kind === 'food'">
                <span>蛋白 {{ e.protein }}g</span>
                <span>纖維 {{ e.fiber }}g</span>
                <span>碳水 {{ e.carbs }}g</span>
                <span>脂肪 {{ e.fat }}g</span>
              </template>
            </div>
            <div v-if="e.keyNutrients.length" class="mt-1 flex flex-wrap gap-1">
              <span v-for="k in e.keyNutrients" :key="k" class="rounded-full bg-violet-500/10 px-2 py-0.5 text-2xs text-violet-600 dark:text-violet-300">{{ k }}</span>
            </div>
            <p v-if="e.note" class="mt-1 text-2xs text-ink-400">{{ e.note }}</p>
          </div>
          <button class="text-ink-300 transition-colors hover:text-rose-500" title="刪除" @click="removeEntry(e.id)">
            <Trash2 class="h-4 w-4" />
          </button>
        </li>
      </ul>
    </section>

    <!-- Empty state -->
    <section v-else class="card-cute p-8 text-center">
      <span class="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-lime-500/10 text-lime-600"><Salad class="h-6 w-6" /></span>
      <p class="text-sm font-semibold text-ink-700">今天還沒有紀錄</p>
      <p class="mt-1 text-xs text-ink-400">記下第一餐，AI 會估算熱量、蛋白質、膳食纖維與維生素，並提示你的熱量赤字。</p>
    </section>
  </div>
</template>
