<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Plus, Trash2, Minus, Target, CheckCircle2, CalendarClock } from 'lucide-vue-next'
import SectionCard from '@/components/ui/SectionCard.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import LoadingState from '@/components/ui/LoadingState.vue'
import ErrorState from '@/components/ui/ErrorState.vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import { goalApi } from '@/api'
import { formatDate } from '@/utils/format'
import type { Goal } from '@/types'

const { t } = useI18n()

const goals = ref<Goal[]>([])
const loading = ref(true)
const error = ref('')

async function load() {
  loading.value = true
  error.value = ''
  try {
    goals.value = await goalApi.list()
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    loading.value = false
  }
}
onMounted(load)

const doneCount = computed(() => goals.value.filter((g) => g.status === 'DONE').length)

const COLORS = ['violet', 'sky', 'emerald', 'amber', 'rose', 'teal'] as const
const BAR: Record<string, string> = {
  violet: 'bg-violet-500',
  sky: 'bg-sky-500',
  emerald: 'bg-emerald-500',
  amber: 'bg-amber-500',
  rose: 'bg-rose-500',
  teal: 'bg-teal-500',
}
const TINT: Record<string, string> = {
  violet: 'text-violet-600 bg-violet-50',
  sky: 'text-sky-600 bg-sky-50',
  emerald: 'text-emerald-600 bg-emerald-50',
  amber: 'text-amber-600 bg-amber-50',
  rose: 'text-rose-600 bg-rose-50',
  teal: 'text-teal-600 bg-teal-50',
}
function bar(g: Goal) { return BAR[g.color ?? 'violet'] ?? BAR.violet }
function tint(g: Goal) { return TINT[g.color ?? 'violet'] ?? TINT.violet }

// Trim trailing .0 so 3 shows as "3" but 3.5 stays "3.5".
function num(n: number) { return Number.isInteger(n) ? String(n) : n.toFixed(1) }

function replaceGoal(updated: Goal) {
  const idx = goals.value.findIndex((x) => x.id === updated.id)
  if (idx >= 0) goals.value[idx] = updated
}

async function step(g: Goal, delta: number) {
  try {
    replaceGoal(await goalApi.addProgress(g.id, delta))
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  }
}

async function remove(g: Goal) {
  if (!window.confirm('確定刪除這個目標？')) return
  try {
    await goalApi.remove(g.id)
    goals.value = goals.value.filter((x) => x.id !== g.id)
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  }
}

// ---- Add ----
const showAdd = ref(false)
const saving = ref(false)
const fTitle = ref('')
const fTarget = ref(10)
const fUnit = ref('')
const fStep = ref(1)
const fDeadline = ref('')
const fColor = ref<string>('violet')
const formError = ref('')

// Per-goal increment step the user picked at creation (kept client-side, defaults 1).
const stepFor = ref<Record<number, number>>({})

function openAdd() {
  fTitle.value = ''
  fTarget.value = 10
  fUnit.value = ''
  fStep.value = 1
  fDeadline.value = ''
  fColor.value = 'violet'
  formError.value = ''
  showAdd.value = true
}

async function submit() {
  formError.value = ''
  if (!fTitle.value.trim()) { formError.value = '請輸入目標名稱'; return }
  if (!fTarget.value || fTarget.value <= 0) { formError.value = '目標數值需大於 0'; return }
  saving.value = true
  try {
    const created = await goalApi.create({
      title: fTitle.value.trim(),
      targetValue: Number(fTarget.value),
      unit: fUnit.value.trim() || undefined,
      deadline: fDeadline.value || null,
      color: fColor.value,
    })
    stepFor.value[created.id] = Math.max(1, Number(fStep.value) || 1)
    goals.value.push(created)
    showAdd.value = false
  } catch (e) {
    formError.value = e instanceof Error ? e.message : String(e)
  } finally {
    saving.value = false
  }
}

function deadlineLabel(g: Goal): string {
  if (g.daysLeft == null) return ''
  if (g.daysLeft > 0) return `剩 ${g.daysLeft} 天`
  if (g.daysLeft === 0) return '今天到期'
  return `逾期 ${-g.daysLeft} 天`
}
</script>

<template>
  <SectionCard>
    <template #action>
      <button class="btn-primary btn-sm gap-1.5" @click="openAdd">
        <Plus class="h-3.5 w-3.5" /> 新增目標
      </button>
    </template>
    <header class="mb-4 flex items-center justify-between">
      <h3 class="section-title">目標管理</h3>
      <span v-if="goals.length" class="text-xs font-medium text-ink-400">已達成 {{ doneCount }}/{{ goals.length }}</span>
    </header>

    <LoadingState v-if="loading" :label="t('common.loading')" />
    <ErrorState v-else-if="error && !goals.length" :message="error" @retry="load" />
    <EmptyState
      v-else-if="!goals.length"
      title="還沒有目標"
      description="設定一個可量化的目標（例如讀 12 本書、跑 100 公里），追蹤進度直到達成。"
    />

    <ul v-else class="space-y-3">
      <li
        v-for="g in goals" :key="g.id"
        class="group rounded-2xl border border-ink-200 bg-surface p-4 transition-colors hover:border-brand-200"
      >
        <div class="flex items-start gap-3">
          <span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" :class="tint(g)">
            <CheckCircle2 v-if="g.status === 'DONE'" class="h-5 w-5" :stroke-width="2" />
            <Target v-else class="h-5 w-5" :stroke-width="2" />
          </span>
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2">
              <p class="truncate text-sm font-semibold" :class="g.status === 'DONE' ? 'text-emerald-600' : 'text-ink-800'">{{ g.title }}</p>
              <span v-if="g.status === 'DONE'" class="shrink-0 rounded-full bg-emerald-50 px-1.5 py-0.5 text-2xs font-medium text-emerald-600 dark:bg-emerald-500/10">已達成</span>
            </div>
            <p v-if="g.deadline" class="mt-0.5 flex items-center gap-1 text-2xs text-ink-400">
              <CalendarClock class="h-3 w-3" /> {{ formatDate(g.deadline) }}
              <span :class="g.daysLeft != null && g.daysLeft < 0 ? 'text-rose-500' : ''">· {{ deadlineLabel(g) }}</span>
            </p>
          </div>
          <button
            class="shrink-0 text-ink-300 opacity-0 transition-opacity hover:text-rose-500 group-hover:opacity-100"
            :aria-label="t('common.delete')"
            @click="remove(g)"
          >
            <Trash2 class="h-4 w-4" />
          </button>
        </div>

        <!-- Progress -->
        <div class="mt-3 flex items-center gap-3">
          <div class="h-2 flex-1 overflow-hidden rounded-full bg-ink-100">
            <div class="h-full rounded-full transition-all" :class="bar(g)" :style="{ width: g.progressPct + '%' }" />
          </div>
          <span class="shrink-0 text-xs font-medium text-ink-500">
            {{ num(g.currentValue) }} / {{ num(g.targetValue) }}<span v-if="g.unit" class="text-ink-400"> {{ g.unit }}</span>
          </span>
        </div>

        <!-- Quick step -->
        <div class="mt-2.5 flex items-center justify-end gap-2">
          <button
            class="flex h-7 w-7 items-center justify-center rounded-lg border border-ink-200 text-ink-500 transition-colors hover:bg-ink-50 disabled:opacity-40"
            :disabled="g.currentValue <= 0"
            aria-label="減少進度"
            @click="step(g, -(stepFor[g.id] || 1))"
          >
            <Minus class="h-4 w-4" />
          </button>
          <span class="min-w-[2.5rem] text-center text-xs text-ink-400">+{{ stepFor[g.id] || 1 }}</span>
          <button
            class="flex h-7 w-7 items-center justify-center rounded-lg border border-ink-200 text-ink-500 transition-colors hover:bg-ink-50 disabled:opacity-40"
            :disabled="g.currentValue >= g.targetValue"
            aria-label="增加進度"
            @click="step(g, stepFor[g.id] || 1)"
          >
            <Plus class="h-4 w-4" />
          </button>
        </div>
      </li>
    </ul>
  </SectionCard>

  <BaseModal :open="showAdd" title="新增目標" @close="showAdd = false">
    <form class="space-y-4" @submit.prevent="submit">
      <label class="block">
        <span class="mb-1 block text-xs font-medium text-ink-500">目標名稱</span>
        <input v-model="fTitle" type="text" placeholder="例如：今年讀 12 本書" class="input" />
      </label>
      <div class="grid grid-cols-3 gap-3">
        <label class="block">
          <span class="mb-1 block text-xs font-medium text-ink-500">目標數值</span>
          <input v-model.number="fTarget" type="number" min="1" step="0.5" class="input" />
        </label>
        <label class="block">
          <span class="mb-1 block text-xs font-medium text-ink-500">單位（{{ t('common.optional') }}）</span>
          <input v-model="fUnit" type="text" placeholder="本 / km" class="input" />
        </label>
        <label class="block">
          <span class="mb-1 block text-xs font-medium text-ink-500">每次 +</span>
          <input v-model.number="fStep" type="number" min="1" step="0.5" class="input" />
        </label>
      </div>
      <label class="block">
        <span class="mb-1 block text-xs font-medium text-ink-500">截止日（{{ t('common.optional') }}）</span>
        <input v-model="fDeadline" type="date" class="input" />
      </label>
      <div class="block">
        <span class="mb-1.5 block text-xs font-medium text-ink-500">顏色</span>
        <div class="flex gap-2">
          <button
            v-for="c in COLORS" :key="c" type="button"
            class="h-7 w-7 rounded-full transition-all"
            :class="[BAR[c], fColor === c ? 'ring-2 ring-ink-400 ring-offset-2 ring-offset-surface' : 'opacity-70 hover:opacity-100']"
            :aria-label="c"
            @click="fColor = c"
          />
        </div>
      </div>
      <p v-if="formError" class="text-sm text-rose-600">{{ formError }}</p>
      <div class="flex justify-end gap-2 pt-1">
        <button type="button" class="btn-secondary btn-sm" @click="showAdd = false">{{ t('common.cancel') }}</button>
        <button type="submit" class="btn-primary btn-sm" :disabled="saving">{{ saving ? t('common.saving') : t('common.add') }}</button>
      </div>
    </form>
  </BaseModal>
</template>
