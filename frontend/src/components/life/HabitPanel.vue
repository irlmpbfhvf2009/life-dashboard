<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Plus, Trash2, Flame, Check } from 'lucide-vue-next'
import SectionCard from '@/components/ui/SectionCard.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import LoadingState from '@/components/ui/LoadingState.vue'
import ErrorState from '@/components/ui/ErrorState.vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import { habitApi } from '@/api'
import type { Habit } from '@/types'

const { t } = useI18n()

const habits = ref<Habit[]>([])
const loading = ref(true)
const error = ref('')

async function load() {
  loading.value = true
  error.value = ''
  try {
    habits.value = await habitApi.list()
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    loading.value = false
  }
}
onMounted(load)

const doneToday = computed(() => habits.value.filter((h) => h.doneToday).length)

// Tailwind tint presets, keyed by the `color` slug stored on the habit.
const COLORS = ['emerald', 'sky', 'violet', 'amber', 'rose', 'teal'] as const
const TINT: Record<string, string> = {
  emerald: 'text-emerald-600 bg-emerald-50',
  sky: 'text-sky-600 bg-sky-50',
  violet: 'text-violet-600 bg-violet-50',
  amber: 'text-amber-600 bg-amber-50',
  rose: 'text-rose-600 bg-rose-50',
  teal: 'text-teal-600 bg-teal-50',
}
const DOT: Record<string, string> = {
  emerald: 'bg-emerald-500',
  sky: 'bg-sky-500',
  violet: 'bg-violet-500',
  amber: 'bg-amber-500',
  rose: 'bg-rose-500',
  teal: 'bg-teal-500',
}
function tint(h: Habit) { return TINT[h.color ?? 'emerald'] ?? TINT.emerald }
function dot(h: Habit) { return DOT[h.color ?? 'emerald'] ?? DOT.emerald }

function replaceHabit(updated: Habit) {
  const idx = habits.value.findIndex((x) => x.id === updated.id)
  if (idx >= 0) habits.value[idx] = updated
}

async function toggle(h: Habit) {
  try {
    const updated = h.doneToday ? await habitApi.uncheck(h.id) : await habitApi.check(h.id)
    replaceHabit(updated)
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  }
}

async function remove(h: Habit) {
  if (!window.confirm('確定刪除這個習慣？歷史紀錄會一併移除。')) return
  try {
    await habitApi.remove(h.id)
    habits.value = habits.value.filter((x) => x.id !== h.id)
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  }
}

// ---- Add ----
const showAdd = ref(false)
const saving = ref(false)
const fName = ref('')
const fEmoji = ref('')
const fTarget = ref(1)
const fColor = ref<string>('emerald')
const formError = ref('')

function openAdd() {
  fName.value = ''
  fEmoji.value = ''
  fTarget.value = 1
  fColor.value = 'emerald'
  formError.value = ''
  showAdd.value = true
}

async function submit() {
  formError.value = ''
  if (!fName.value.trim()) {
    formError.value = '請輸入習慣名稱'
    return
  }
  saving.value = true
  try {
    const created = await habitApi.create({
      name: fName.value.trim(),
      emoji: fEmoji.value.trim() || undefined,
      color: fColor.value,
      targetPerDay: Math.max(1, Number(fTarget.value) || 1),
    })
    habits.value.push(created)
    showAdd.value = false
  } catch (e) {
    formError.value = e instanceof Error ? e.message : String(e)
  } finally {
    saving.value = false
  }
}

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']
function weekday(iso: string) { return WEEKDAYS[new Date(`${iso}T00:00:00`).getDay()] }
</script>

<template>
  <SectionCard>
    <template #action>
      <button class="btn-primary btn-sm gap-1.5" @click="openAdd">
        <Plus class="h-3.5 w-3.5" /> 新增習慣
      </button>
    </template>
    <header class="mb-4 flex items-center justify-between">
      <h3 class="section-title">習慣養成</h3>
      <span v-if="habits.length" class="text-xs font-medium text-ink-400">今日 {{ doneToday }}/{{ habits.length }} 完成</span>
    </header>

    <LoadingState v-if="loading" :label="t('common.loading')" />
    <ErrorState v-else-if="error && !habits.length" :message="error" @retry="load" />
    <EmptyState
      v-else-if="!habits.length"
      title="還沒有習慣"
      description="建立第一個每天想養成的習慣，開始累積連續天數。"
    />

    <ul v-else class="space-y-2.5">
      <li
        v-for="h in habits" :key="h.id"
        class="group flex items-center gap-3.5 rounded-2xl border border-ink-200 bg-surface p-3.5 transition-colors hover:border-brand-200"
      >
        <!-- Check button (toggles today) -->
        <button
          class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-lg transition-all"
          :class="h.doneToday ? dot(h) + ' text-white shadow-card' : tint(h) + ' hover:scale-105'"
          :aria-label="h.doneToday ? '取消今日打卡' : '今日打卡'"
          @click="toggle(h)"
        >
          <span v-if="h.emoji && !h.doneToday">{{ h.emoji }}</span>
          <Check v-else-if="h.doneToday" class="h-5 w-5" :stroke-width="2.5" />
          <span v-else>{{ h.emoji || '·' }}</span>
        </button>

        <!-- Name + week dots -->
        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-2">
            <p class="truncate text-sm font-semibold text-ink-800">{{ h.name }}</p>
            <span v-if="h.streak > 0" class="inline-flex items-center gap-0.5 rounded-full bg-orange-50 px-1.5 py-0.5 text-2xs font-medium text-orange-600 dark:bg-orange-500/10">
              <Flame class="h-3 w-3" /> {{ h.streak }}
            </span>
          </div>
          <div class="mt-1.5 flex items-center gap-1.5">
            <span
              v-for="d in h.recentDays" :key="d.date"
              class="flex h-4 w-4 items-center justify-center rounded-[5px] text-[8px] font-medium"
              :class="d.done ? dot(h) + ' text-white' : 'bg-ink-100 text-ink-300'"
              :title="d.date"
            >{{ weekday(d.date) }}</span>
          </div>
        </div>

        <!-- Target progress (only when > 1/day) -->
        <span v-if="h.targetPerDay > 1" class="shrink-0 text-xs text-ink-400">{{ h.todayCount }}/{{ h.targetPerDay }}</span>

        <button
          class="shrink-0 text-ink-300 opacity-0 transition-opacity hover:text-rose-500 group-hover:opacity-100"
          :aria-label="t('common.delete')"
          @click="remove(h)"
        >
          <Trash2 class="h-4 w-4" />
        </button>
      </li>
    </ul>
  </SectionCard>

  <BaseModal :open="showAdd" title="新增習慣" @close="showAdd = false">
    <form class="space-y-4" @submit.prevent="submit">
      <div class="grid grid-cols-[auto,1fr] gap-3">
        <label class="block">
          <span class="mb-1 block text-xs font-medium text-ink-500">圖示</span>
          <input v-model="fEmoji" type="text" maxlength="2" placeholder="🏃" class="input w-16 text-center text-lg" />
        </label>
        <label class="block">
          <span class="mb-1 block text-xs font-medium text-ink-500">習慣名稱</span>
          <input v-model="fName" type="text" placeholder="例如：每天喝水、閱讀 30 分鐘" class="input" />
        </label>
      </div>

      <label class="block">
        <span class="mb-1 block text-xs font-medium text-ink-500">每日次數</span>
        <input v-model.number="fTarget" type="number" min="1" max="20" class="input w-24" />
      </label>

      <div class="block">
        <span class="mb-1.5 block text-xs font-medium text-ink-500">顏色</span>
        <div class="flex gap-2">
          <button
            v-for="c in COLORS" :key="c" type="button"
            class="h-7 w-7 rounded-full transition-all"
            :class="[DOT[c], fColor === c ? 'ring-2 ring-ink-400 ring-offset-2 ring-offset-surface' : 'opacity-70 hover:opacity-100']"
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
