<script setup lang="ts">
// Finance dashboard body, extracted from the old FinanceView so it can live as a
// tab inside 生活管理 (alongside 待辦 / 心情日記). No PageHeader here — the host
// (LifeView) renders the section title; the add button sits in this panel's own toolbar.
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Plus, TrendingDown, TrendingUp, Wallet, Receipt, CalendarDays, Trash2 } from 'lucide-vue-next'
import StatCard from '@/components/ui/StatCard.vue'
import SectionCard from '@/components/ui/SectionCard.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import LoadingState from '@/components/ui/LoadingState.vue'
import ErrorState from '@/components/ui/ErrorState.vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import TrendChartCard from '@/components/ui/TrendChartCard.vue'
import CategoryDonut from '@/components/finance/CategoryDonut.vue'
import AddExpenseForm from '@/components/finance/AddExpenseForm.vue'
import { expenseApi } from '@/api'
import { formatMoney, formatDate } from '@/utils/format'
import type { Expense, ExpenseType } from '@/types'

const { t, locale } = useI18n()

const expenses = ref<Expense[]>([])
const loading = ref(true)
const error = ref('')

async function load() {
  loading.value = true
  error.value = ''
  try {
    expenses.value = await expenseApi.list()
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    loading.value = false
  }
}
onMounted(load)

// Older rows created before the income/expense split have no type — treat as expense.
const isIncome = (e: Expense) => e.type === 'INCOME'
const isExpense = (e: Expense) => e.type !== 'INCOME'

// ---- Current month helpers ----
const now = new Date()
const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

const thisMonth = computed(() => expenses.value.filter((e) => e.date.slice(0, 7) === monthKey))
const monthIncome = computed(() => thisMonth.value.filter(isIncome).reduce((s, e) => s + e.amount, 0))
const monthExpense = computed(() => thisMonth.value.filter(isExpense).reduce((s, e) => s + e.amount, 0))
const monthNet = computed(() => monthIncome.value - monthExpense.value)

// Expense category breakdown for the current month, sorted desc.
const byCategory = computed(() => {
  const map = new Map<string, number>()
  for (const e of thisMonth.value.filter(isExpense)) map.set(e.category, (map.get(e.category) ?? 0) + e.amount)
  return [...map.entries()]
    .map(([category, total]) => ({ category, total }))
    .sort((a, b) => b.total - a.total)
})
const topCategory = computed(() => byCategory.value[0])

// ---- Last 6 months: income vs expense ----
const trend = computed(() => {
  const labels: string[] = []
  const expenseTotals: number[] = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const rows = expenses.value.filter((e) => e.date.slice(0, 7) === key)
    labels.push(d.toLocaleDateString(locale.value, { month: 'short' }))
    expenseTotals.push(rows.filter(isExpense).reduce((s, e) => s + e.amount, 0))
  }
  return { labels, expenseTotals }
})

// ---- Recent entries (latest 30, already sorted desc by the backend) ----
const recent = computed(() => expenses.value.slice(0, 30))

// ---- Add / delete ----
const showAdd = ref(false)
const addForm = ref<InstanceType<typeof AddExpenseForm> | null>(null)

async function onSubmit(payload: { date: string; amount: number; category: string; type: ExpenseType; description?: string }) {
  if (addForm.value) addForm.value.saving = true
  try {
    const created = await expenseApi.create(payload)
    expenses.value.unshift(created)
    expenses.value.sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id)
    showAdd.value = false
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    if (addForm.value) addForm.value.saving = false
  }
}

async function remove(e: Expense) {
  if (!window.confirm(t('common.confirmDeleteEntry'))) return
  try {
    await expenseApi.remove(e.id)
    expenses.value = expenses.value.filter((x) => x.id !== e.id)
  } catch (err) {
    error.value = err instanceof Error ? err.message : String(err)
  }
}
</script>

<template>
  <div class="mb-4 flex items-center justify-between">
    <p class="text-sm text-ink-500">{{ t('finance.subtitle') }}</p>
    <button class="btn-primary btn-sm gap-1.5" @click="showAdd = true">
      <Plus class="h-3.5 w-3.5" /> {{ t('finance.add') }}
    </button>
  </div>

  <LoadingState v-if="loading" :label="t('common.loading')" />
  <ErrorState v-else-if="error && !expenses.length" :message="error" @retry="load" />

  <div v-else>
    <!-- Stat cards: 收入 / 支出 / 結餘 / 最大支出 -->
    <div class="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard :label="t('finance.income')" :value="formatMoney(monthIncome)" :icon="TrendingUp" :sub="monthKey" />
      <StatCard :label="t('finance.expense')" :value="formatMoney(monthExpense)" :icon="TrendingDown" :sub="monthKey" />
      <StatCard
        :label="t('finance.net')"
        :value="formatMoney(monthNet)"
        :icon="Wallet"
        :sub="monthNet >= 0 ? t('finance.surplus') : t('finance.deficit')"
      />
      <StatCard
        :label="t('finance.topCategory')"
        :value="topCategory ? topCategory.category : '—'"
        :icon="Receipt"
        :sub="topCategory ? formatMoney(topCategory.total) : t('finance.noSpending')"
      />
    </div>

    <div class="mb-6 grid gap-4 lg:grid-cols-2">
      <!-- Expense category breakdown -->
      <SectionCard :title="t('finance.byCategory')" :icon="Receipt">
        <CategoryDonut v-if="byCategory.length" :items="byCategory" />
        <EmptyState v-else :title="t('finance.noSpending')" :description="t('finance.noSpendingDesc')" />
      </SectionCard>

      <!-- 6-month expense trend -->
      <TrendChartCard
        :title="t('finance.trend6m')"
        :labels="trend.labels"
        :data="trend.expenseTotals"
        color="#6366f1"
      />
    </div>

    <!-- Recent entries -->
    <SectionCard :title="t('finance.recent')" :icon="CalendarDays">
      <EmptyState v-if="!recent.length" :title="t('finance.noExpenses')" :description="t('finance.noSpendingDesc')" />
      <ul v-else class="divide-y divide-ink-100">
        <li v-for="e in recent" :key="e.id" class="group flex items-center gap-3 py-2.5">
          <span class="badge shrink-0" :class="isIncome(e) ? 'badge-green' : 'badge-gray'">{{ e.category }}</span>
          <div class="min-w-0 flex-1">
            <p v-if="e.description" class="truncate text-sm text-ink-700">{{ e.description }}</p>
            <p class="text-xs text-ink-400">{{ formatDate(e.date) }}</p>
          </div>
          <span
            class="shrink-0 text-sm font-semibold"
            :class="isIncome(e) ? 'text-emerald-600' : 'text-ink-900'"
          >{{ isIncome(e) ? '+' : '−' }}{{ formatMoney(e.amount) }}</span>
          <button
            class="shrink-0 text-ink-300 opacity-0 transition-opacity hover:text-rose-500 group-hover:opacity-100"
            :aria-label="t('common.delete')" @click="remove(e)"
          >
            <Trash2 class="h-4 w-4" />
          </button>
        </li>
      </ul>
    </SectionCard>
  </div>

  <!-- Add modal -->
  <BaseModal :open="showAdd" :title="t('finance.add')" @close="showAdd = false">
    <AddExpenseForm ref="addForm" @submit="onSubmit" @cancel="showAdd = false" />
  </BaseModal>
</template>
