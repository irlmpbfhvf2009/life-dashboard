<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  Sparkles, Trash2, Loader2, Flame, Dumbbell, Utensils, RefreshCw, Salad,
  Pencil, Check, X, Droplets, RotateCcw,
} from 'lucide-vue-next'
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
  let intake = 0, burned = 0, protein = 0, fiber = 0, starch = 0, sugar = 0,
    carbs = 0, fat = 0, saturatedFat = 0, addedSugar = 0, sodium = 0
  for (const e of entries.value) {
    if (e.kind === 'exercise') { burned += e.calories } else {
      intake += e.calories; protein += e.protein; fiber += e.fiber
      starch += e.starch ?? 0; sugar += e.sugar ?? 0; carbs += e.carbs; fat += e.fat
      saturatedFat += e.saturatedFat ?? 0; addedSugar += e.addedSugar ?? 0; sodium += e.sodium ?? 0
    }
  }
  return {
    intake: Math.round(intake), burned: Math.round(burned),
    protein: Math.round(protein), fiber: Math.round(fiber),
    starch: Math.round(starch), sugar: Math.round(sugar),
    carbs: Math.round(carbs), fat: Math.round(fat),
    saturatedFat: Math.round(saturatedFat), addedSugar: Math.round(addedSugar), sodium: Math.round(sodium),
  }
})
// 熱量赤字 = 每日消耗(TDEE) − 吃進 + 運動消耗
const deficit = computed(() => metrics.value.tdee - totals.value.intake + totals.value.burned)
// Merge 攝取/運動/赤字 into a single "today's calorie budget" bar: the budget is
// TDEE plus whatever exercise earned back, and intake is what's been spent from it.
// Whatever's left over is exactly the deficit above — one number, shown once.
const budget = computed(() => metrics.value.tdee + totals.value.burned)
const budgetPct = computed(() => Math.min(100, Math.round((totals.value.intake / budget.value) * 100)))
const proteinTarget = computed(() => Math.round(props.profile.weightKg * 1.6))
const fiberTarget = computed(() => (props.profile.gender === 'male' ? 30 : 25))
// General adult guidelines (WHO/AHA-style, not personalised beyond calorie need where noted).
const addedSugarTarget = 25 // g/day
const sodiumTarget = 2000 // mg/day
const saturatedFatTarget = computed(() => Math.max(10, Math.round((metrics.value.tdee * 0.07) / 9))) // ~7% of TDEE from sat fat

const proteinPct = computed(() => Math.min(100, Math.round((totals.value.protein / proteinTarget.value) * 100)))
const fiberPct = computed(() => Math.min(100, Math.round((totals.value.fiber / fiberTarget.value) * 100)))
const addedSugarPct = computed(() => Math.min(100, Math.round((totals.value.addedSugar / addedSugarTarget) * 100)))
const sodiumPct = computed(() => Math.min(100, Math.round((totals.value.sodium / sodiumTarget) * 100)))
const saturatedFatPct = computed(() => Math.min(100, Math.round((totals.value.saturatedFat / saturatedFatTarget.value) * 100)))
const sodiumHigh = computed(() => totals.value.sodium > sodiumTarget)

// ---- Carb source breakdown (澱粉/糖/纖維), as a share of total carbs ----
const carbBreakdown = computed(() => {
  const c = totals.value.carbs
  if (c <= 0) return { starchPct: 0, sugarPct: 0, fiberPct: 0 }
  return {
    starchPct: Math.round((totals.value.starch / c) * 100),
    sugarPct: Math.round((totals.value.sugar / c) * 100),
    fiberPct: Math.round((totals.value.fiber / c) * 100),
  }
})

const error = ref('')

function removeEntry(id: string) {
  store.update((d) => {
    d.log.entries = d.log.entries.filter((x) => x.id !== id)
    d.log.review = null
  })
}

function resetToday() {
  if (!window.confirm('確定要清空今天的所有紀錄嗎？此動作無法復原。')) return
  store.update((d) => {
    d.log.entries = []
    d.log.review = null
  })
}

// ---- Edit an entry: re-describe it in text, AI re-analyses and replaces it ----
const editingId = ref<string | null>(null)
const editText = ref('')
const editBusy = ref(false)
const editError = ref('')
const { active: editSlow, start: startEditSlow, stop: stopEditSlow } = useColdStartHint()

function startEdit(e: FoodEntry) {
  editingId.value = e.id
  editText.value = e.label
  editError.value = ''
}
function cancelEdit() {
  editingId.value = null
  editText.value = ''
  editError.value = ''
}
async function submitEdit(id: string) {
  const text = editText.value.trim()
  if (!text || editBusy.value) return
  editBusy.value = true
  editError.value = ''
  startEditSlow()
  try {
    // Editing corrects exactly ONE existing entry, so only ever take the first
    // result and discard anything else — the multi-item split (used by the main
    // log box) would otherwise silently add extra entries on top of the one
    // being edited, inflating today's totals.
    const [first] = await aiApi.nutrition({ text, weightKg: props.profile.weightKg })
    if (!first) throw new Error('AI 沒有回傳結果，請再試一次')
    store.update((d) => {
      const idx = d.log.entries.findIndex((x) => x.id === id)
      if (idx < 0) return
      const prev = d.log.entries[idx]
      d.log.entries[idx] = {
        ...prev,
        kind: first.kind,
        label: first.label,
        calories: Math.round(first.calories),
        protein: Math.round(first.protein),
        fiber: Math.round(first.fiber),
        starch: Math.round(first.starch ?? 0),
        sugar: Math.round(first.sugar ?? 0),
        carbs: Math.round(first.carbs),
        fat: Math.round(first.fat),
        saturatedFat: Math.round(first.saturatedFat ?? 0),
        addedSugar: Math.round(first.addedSugar ?? 0),
        sodium: Math.round(first.sodium ?? 0),
        keyNutrients: first.keyNutrients ?? [],
        note: first.note ?? '',
      }
      d.log.review = null
    })
    cancelEdit()
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : ''
    editError.value = /network error|timeout/i.test(msg)
      ? 'AI 回應時間過長或網路不穩，請稍後再試一次。'
      : (msg || 'AI 重新分析失敗，請再試一次')
  } finally {
    editBusy.value = false
    stopEditSlow()
  }
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
      starch: totals.value.starch,
      sugar: totals.value.sugar,
      carbs: totals.value.carbs,
      fat: totals.value.fat,
      saturatedFat: totals.value.saturatedFat,
      addedSugar: totals.value.addedSugar,
      sodium: totals.value.sodium,
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
      <div class="mb-4 flex items-center justify-between">
        <h3 class="section-title">今日總結</h3>
        <button class="btn-ghost btn-sm gap-1 text-ink-400 hover:text-rose-500" @click="resetToday">
          <RotateCcw class="h-3.5 w-3.5" /> 清空今天
        </button>
      </div>

      <!-- Macro progress -->
      <div class="space-y-3">
        <div>
          <div class="mb-1 flex items-baseline justify-between text-xs">
            <span class="font-medium text-ink-700">熱量</span>
            <span class="text-ink-400">
              攝取 {{ totals.intake }}<template v-if="totals.burned"> · 運動 −{{ totals.burned }}</template> kcal
            </span>
          </div>
          <div class="h-2 overflow-hidden rounded-full bg-ink-100">
            <div class="h-full rounded-full transition-all" :class="deficit >= 0 ? 'bg-sky-500' : 'bg-rose-500'" :style="{ width: budgetPct + '%' }" />
          </div>
          <div class="mt-1 flex items-baseline justify-between text-2xs">
            <span class="text-ink-400">
              今日額度 {{ budget }} kcal（TDEE {{ metrics.tdee }}<template v-if="totals.burned"> ＋運動 {{ totals.burned }}</template>）
            </span>
            <span class="font-semibold" :class="deficit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'">
              {{ deficit >= 0 ? '赤字' : '超標' }} {{ Math.abs(deficit) }} kcal
            </span>
          </div>
        </div>
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
        <div>
          <div class="mb-1 flex items-baseline justify-between text-xs">
            <span class="font-medium text-ink-700">添加糖</span>
            <span :class="addedSugarPct >= 100 ? 'text-rose-500 font-semibold' : 'text-ink-400'">{{ totals.addedSugar }} / {{ addedSugarTarget }} g</span>
          </div>
          <div class="h-2 overflow-hidden rounded-full bg-ink-100">
            <div class="h-full rounded-full transition-all" :class="addedSugarPct >= 100 ? 'bg-rose-500' : 'bg-amber-400'" :style="{ width: addedSugarPct + '%' }" />
          </div>
        </div>
        <div>
          <div class="mb-1 flex items-baseline justify-between text-xs">
            <span class="font-medium text-ink-700">鈉</span>
            <span :class="sodiumHigh ? 'text-rose-500 font-semibold' : 'text-ink-400'">{{ totals.sodium }} / {{ sodiumTarget }} mg</span>
          </div>
          <div class="h-2 overflow-hidden rounded-full bg-ink-100">
            <div class="h-full rounded-full transition-all" :class="sodiumHigh ? 'bg-rose-500' : 'bg-sky-400'" :style="{ width: sodiumPct + '%' }" />
          </div>
          <p v-if="sodiumHigh" class="mt-1 flex items-center gap-1 text-2xs text-rose-500">
            <Droplets class="h-3 w-3" /> 鈉攝取偏高，建議今天多喝水
          </p>
        </div>
        <div>
          <div class="mb-1 flex items-baseline justify-between text-xs">
            <span class="font-medium text-ink-700">飽和脂肪</span>
            <span :class="saturatedFatPct >= 100 ? 'text-rose-500 font-semibold' : 'text-ink-400'">{{ totals.saturatedFat }} / {{ saturatedFatTarget }} g</span>
          </div>
          <div class="h-2 overflow-hidden rounded-full bg-ink-100">
            <div class="h-full rounded-full transition-all" :class="saturatedFatPct >= 100 ? 'bg-rose-500' : 'bg-orange-400'" :style="{ width: saturatedFatPct + '%' }" />
          </div>
        </div>

        <!-- Carb source breakdown -->
        <div v-if="totals.carbs > 0">
          <div class="mb-1 flex items-baseline justify-between text-xs">
            <span class="font-medium text-ink-700">碳水來源</span>
            <span class="text-ink-400">共 {{ totals.carbs }} g</span>
          </div>
          <div class="flex h-2 overflow-hidden rounded-full bg-ink-100">
            <div class="h-full bg-amber-400" :style="{ width: carbBreakdown.starchPct + '%' }" title="澱粉" />
            <div class="h-full bg-rose-400" :style="{ width: carbBreakdown.sugarPct + '%' }" title="糖" />
            <div class="h-full bg-lime-500" :style="{ width: carbBreakdown.fiberPct + '%' }" title="纖維" />
          </div>
          <div class="mt-1 flex gap-3 text-2xs text-ink-400">
            <span class="flex items-center gap-1"><span class="h-1.5 w-1.5 rounded-full bg-amber-400" />澱粉 {{ carbBreakdown.starchPct }}%</span>
            <span class="flex items-center gap-1"><span class="h-1.5 w-1.5 rounded-full bg-rose-400" />糖 {{ carbBreakdown.sugarPct }}%</span>
            <span class="flex items-center gap-1"><span class="h-1.5 w-1.5 rounded-full bg-lime-500" />纖維 {{ carbBreakdown.fiberPct }}%</span>
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

          <div v-if="review.excess?.length">
            <p class="mb-1 text-xs font-semibold text-rose-500">今天可能超標</p>
            <ul class="space-y-1">
              <li v-for="g in review.excess" :key="g.nutrient" class="flex gap-2 text-xs text-ink-600">
                <span class="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-rose-400" />
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
        <li v-for="e in [...entries].reverse()" :key="e.id" class="group rounded-2xl bg-ink-50 p-3">
          <div class="flex items-start gap-3">
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
                  <span v-if="e.sodium">鈉 {{ e.sodium }}mg</span>
                  <span v-if="e.addedSugar">添加糖 {{ e.addedSugar }}g</span>
                </template>
              </div>
              <div v-if="e.keyNutrients.length" class="mt-1 flex flex-wrap gap-1">
                <span v-for="k in e.keyNutrients" :key="k" class="rounded-full bg-violet-500/10 px-2 py-0.5 text-2xs text-violet-600 dark:text-violet-300">{{ k }}</span>
              </div>
              <p v-if="e.note" class="mt-1 text-2xs text-ink-400">{{ e.note }}</p>
            </div>
            <div class="flex shrink-0 items-center gap-2">
              <button v-if="aiEnabled" class="text-ink-300 transition-colors hover:text-brand-500" title="編輯，讓 AI 重新分析" @click="startEdit(e)">
                <Pencil class="h-4 w-4" />
              </button>
              <button class="text-ink-300 transition-colors hover:text-rose-500" title="刪除" @click="removeEntry(e.id)">
                <Trash2 class="h-4 w-4" />
              </button>
            </div>
          </div>

          <!-- Inline edit box -->
          <div v-if="editingId === e.id" class="mt-2.5 rounded-xl bg-surface p-2.5">
            <textarea
              v-model="editText"
              rows="2"
              :disabled="editBusy"
              placeholder="重新描述這一筆，例如：加了起司的雞肉三明治"
              class="input resize-none !text-sm"
            />
            <div class="mt-2 flex items-center gap-2">
              <button class="btn-ghost btn-sm gap-1" :disabled="editBusy" @click="cancelEdit">
                <X class="h-3.5 w-3.5" /> 取消
              </button>
              <button class="btn-primary btn-sm ml-auto gap-1.5" :disabled="editBusy || !editText.trim()" @click="submitEdit(e.id)">
                <Loader2 v-if="editBusy" class="h-3.5 w-3.5 animate-spin" />
                <Check v-else class="h-3.5 w-3.5" />
                {{ editBusy ? (editSlow ? '啟動中…' : '分析中…') : '重新分析' }}
              </button>
            </div>
            <p v-if="editError" class="mt-1.5 text-2xs text-rose-500">{{ editError }}</p>
          </div>
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
