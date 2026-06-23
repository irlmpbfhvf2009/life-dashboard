<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { expenseApi } from '@/api'
import { useAsync } from '@/composables/useAsync'
import type { Expense, MonthlyStats } from '@/types'
import PageHeader from '@/components/ui/PageHeader.vue'
import LoadingSpinner from '@/components/ui/LoadingSpinner.vue'
import ErrorState from '@/components/ui/ErrorState.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import StatCard from '@/components/ui/StatCard.vue'
import DoughnutChart from '@/components/charts/DoughnutChart.vue'
import { formatDate, formatMoney, todayISO } from '@/utils/format'

const emptyStats: MonthlyStats = { month: '', total: 0, byCategory: [] }

const { data: stats, loading: statsLoading, error: statsError, run: loadStats } =
  useAsync<MonthlyStats>(() => expenseApi.monthly(), emptyStats)
const { data: list, loading: listLoading, error: listError, run: loadList } =
  useAsync<Expense[]>(expenseApi.list, [])

const saving = ref(false)
const formError = ref<string | null>(null)
const form = reactive({ date: todayISO(), amount: '', category: '', description: '' })

const { t, locale } = useI18n()

// Localized category suggestions (datalist). Stored values are whatever the
// user types/picks; these are only hints.
const CATEGORY_MAP: Record<string, string[]> = {
  'zh-TW': ['餐飲', '交通', '購物', '帳單', '醫療', '娛樂', '其他'],
  en: ['Food', 'Transport', 'Shopping', 'Bills', 'Health', 'Entertainment', 'Other'],
}
const CATEGORIES = computed(() => CATEGORY_MAP[locale.value] ?? CATEGORY_MAP.en)
const PALETTE = ['#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#06b6d4', '#8b5cf6', '#64748b']

onMounted(() => {
  loadStats()
  loadList()
})

async function refreshAll() {
  await Promise.all([loadStats(), loadList()])
}

async function add() {
  const amt = Number(form.amount)
  if (!form.date || !amt || amt <= 0 || !form.category.trim()) {
    formError.value = t('expenses.invalidInput')
    return
  }
  saving.value = true
  formError.value = null
  try {
    await expenseApi.create({
      date: form.date,
      amount: amt,
      category: form.category.trim(),
      description: form.description.trim() || undefined,
    })
    form.amount = ''
    form.description = ''
    await refreshAll()
  } catch (e) {
    formError.value = (e as Error).message
  } finally {
    saving.value = false
  }
}

async function remove(rec: Expense) {
  if (!confirm(t('common.confirmDeleteEntry'))) return
  await expenseApi.remove(rec.id)
  await refreshAll()
}

const chart = computed(() => ({
  labels: stats.value.byCategory.map((c) => c.category),
  datasets: [
    {
      data: stats.value.byCategory.map((c) => Number(c.total)),
      backgroundColor: stats.value.byCategory.map((_, i) => PALETTE[i % PALETTE.length]),
      borderWidth: 0,
    },
  ],
}))
</script>

<template>
  <div>
    <PageHeader :title="$t('expenses.title')" :subtitle="$t('expenses.subtitle')" />

    <form class="card mb-6 flex flex-wrap items-end gap-3 p-4" @submit.prevent="add">
      <div>
        <label class="label">{{ $t('common.date') }}</label>
        <input v-model="form.date" type="date" class="input w-40" />
      </div>
      <div>
        <label class="label">{{ $t('expenses.amount') }}</label>
        <input v-model="form.amount" type="number" step="1" min="0" class="input w-32" placeholder="0" />
      </div>
      <div>
        <label class="label">{{ $t('expenses.category') }}</label>
        <input v-model="form.category" class="input w-40" list="cat-list" :placeholder="$t('expenses.categoryPlaceholder')" />
        <datalist id="cat-list">
          <option v-for="c in CATEGORIES" :key="c" :value="c" />
        </datalist>
      </div>
      <div class="min-w-[12rem] flex-1">
        <label class="label">{{ $t('expenses.descLabel') }}</label>
        <input v-model="form.description" class="input" :placeholder="$t('common.optional')" />
      </div>
      <button type="submit" class="btn-primary" :disabled="saving">
        {{ saving ? $t('common.saving') : $t('common.add') }}
      </button>
      <p v-if="formError" class="w-full text-sm text-red-600">{{ formError }}</p>
    </form>

    <div class="mb-6 grid gap-6 lg:grid-cols-3">
      <div class="card p-5 lg:col-span-1">
        <h3 class="mb-4 text-sm font-semibold text-slate-700">{{ $t('expenses.thisMonth') }}</h3>
        <LoadingSpinner v-if="statsLoading" />
        <ErrorState v-else-if="statsError" :message="statsError" @retry="loadStats" />
        <template v-else>
          <StatCard :label="$t('expenses.totalSpent')" :value="formatMoney(stats.total)" accent="amber" />
        </template>
      </div>
      <div class="card p-5 lg:col-span-2">
        <h3 class="mb-4 text-sm font-semibold text-slate-700">{{ $t('expenses.byCategory') }}</h3>
        <DoughnutChart v-if="stats.byCategory.length" :data="chart" />
        <EmptyState v-else :title="$t('expenses.noSpending')" :description="$t('expenses.noSpendingDesc')" />
      </div>
    </div>

    <div class="card p-5">
      <h3 class="mb-4 text-sm font-semibold text-slate-700">{{ $t('common.history') }}</h3>
      <LoadingSpinner v-if="listLoading" />
      <ErrorState v-else-if="listError" :message="listError" @retry="loadList" />
      <EmptyState v-else-if="!list.length" :title="$t('expenses.noExpenses')" />
      <ul v-else class="divide-y divide-slate-100">
        <li v-for="rec in list" :key="rec.id" class="flex items-center gap-3 py-3 text-sm">
          <span class="w-24 text-slate-400">{{ formatDate(rec.date) }}</span>
          <span class="badge bg-slate-100 text-slate-600">{{ rec.category }}</span>
          <span class="flex-1 truncate text-slate-500">{{ rec.description }}</span>
          <span class="font-semibold text-slate-800">{{ formatMoney(rec.amount) }}</span>
          <button class="text-slate-300 hover:text-red-500" @click="remove(rec)">🗑</button>
        </li>
      </ul>
    </div>
  </div>
</template>
