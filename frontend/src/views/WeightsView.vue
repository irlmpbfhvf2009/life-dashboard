<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { weightApi } from '@/api'
import { useAsync } from '@/composables/useAsync'
import type { WeightRecord, WeightStats } from '@/types'
import PageHeader from '@/components/ui/PageHeader.vue'
import LoadingSpinner from '@/components/ui/LoadingSpinner.vue'
import ErrorState from '@/components/ui/ErrorState.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import StatCard from '@/components/ui/StatCard.vue'
import LineChart from '@/components/charts/LineChart.vue'
import { formatDate, todayISO } from '@/utils/format'

const { t } = useI18n()
const range = ref<'7d' | '30d' | '90d'>('30d')

const emptyStats: WeightStats = {
  range: '30d',
  count: 0,
  min: null,
  max: null,
  average: null,
  change: null,
  points: [],
}

const { data: stats, loading: statsLoading, error: statsError, run: loadStats } =
  useAsync<WeightStats>(() => weightApi.stats(range.value), emptyStats)
const { data: list, loading: listLoading, error: listError, run: loadList } =
  useAsync<WeightRecord[]>(weightApi.list, [])

const saving = ref(false)
const formError = ref<string | null>(null)
const form = reactive({ date: todayISO(), weight: '', note: '' })

onMounted(() => {
  loadStats()
  loadList()
})

function setRange(r: '7d' | '30d' | '90d') {
  range.value = r
  loadStats()
}

async function refreshAll() {
  await Promise.all([loadStats(), loadList()])
}

async function add() {
  const w = Number(form.weight)
  if (!form.date || !w || w <= 0) {
    formError.value = t('weights.invalidInput')
    return
  }
  saving.value = true
  formError.value = null
  try {
    await weightApi.create({ date: form.date, weight: w, note: form.note.trim() || undefined })
    form.weight = ''
    form.note = ''
    await refreshAll()
  } catch (e) {
    formError.value = (e as Error).message
  } finally {
    saving.value = false
  }
}

async function remove(rec: WeightRecord) {
  if (!confirm(t('common.confirmDeleteEntry'))) return
  await weightApi.remove(rec.id)
  await refreshAll()
}

const chart = computed(() => ({
  labels: stats.value.points.map((p) => formatDate(p.date)),
  datasets: [
    {
      label: 'Weight',
      data: stats.value.points.map((p) => Number(p.weight)),
      borderColor: '#4f46e5',
      backgroundColor: 'rgba(79,70,229,0.12)',
      tension: 0.35,
      fill: true,
      pointRadius: 3,
    },
  ],
}))
</script>

<template>
  <div>
    <PageHeader :title="$t('weights.title')" :subtitle="$t('weights.subtitle')" />

    <!-- Add form -->
    <form class="card mb-6 flex flex-wrap items-end gap-3 p-4" @submit.prevent="add">
      <div>
        <label class="label">{{ $t('common.date') }}</label>
        <input v-model="form.date" type="date" class="input w-40" />
      </div>
      <div>
        <label class="label">{{ $t('weights.weightKg') }}</label>
        <input v-model="form.weight" type="number" step="0.1" min="0" class="input w-32" placeholder="70.5" />
      </div>
      <div class="min-w-[12rem] flex-1">
        <label class="label">{{ $t('common.note') }}</label>
        <input v-model="form.note" class="input" :placeholder="$t('common.optional')" />
      </div>
      <button type="submit" class="btn-primary" :disabled="saving">
        {{ saving ? $t('common.saving') : $t('common.add') }}
      </button>
      <p v-if="formError" class="w-full text-sm text-red-600">{{ formError }}</p>
    </form>

    <!-- Range + chart -->
    <div class="card mb-6 p-5">
      <div class="mb-4 flex items-center justify-between">
        <h3 class="text-sm font-semibold text-slate-700">{{ $t('weights.trend') }}</h3>
        <div class="flex gap-1">
          <button
            v-for="r in ['7d', '30d', '90d']"
            :key="r"
            class="rounded-md px-3 py-1 text-xs"
            :class="range === r ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600'"
            @click="setRange(r as '7d' | '30d' | '90d')"
          >
            {{ r }}
          </button>
        </div>
      </div>

      <LoadingSpinner v-if="statsLoading" />
      <ErrorState v-else-if="statsError" :message="statsError" @retry="loadStats" />
      <template v-else>
        <div class="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard :label="$t('weights.average')" :value="stats.average != null ? `${stats.average} kg` : '—'" />
          <StatCard :label="$t('weights.min')" :value="stats.min != null ? `${stats.min} kg` : '—'" accent="green" />
          <StatCard :label="$t('weights.max')" :value="stats.max != null ? `${stats.max} kg` : '—'" accent="amber" />
          <StatCard
            :label="$t('weights.change')"
            :value="stats.change != null ? `${stats.change > 0 ? '+' : ''}${stats.change} kg` : '—'"
            :accent="stats.change != null && stats.change > 0 ? 'rose' : 'green'"
          />
        </div>
        <LineChart v-if="stats.points.length" :data="chart" />
        <EmptyState v-else :title="$t('weights.noRangeData')" :description="$t('weights.noRangeDataDesc')" />
      </template>
    </div>

    <!-- History -->
    <div class="card p-5">
      <h3 class="mb-4 text-sm font-semibold text-slate-700">{{ $t('common.history') }}</h3>
      <LoadingSpinner v-if="listLoading" />
      <ErrorState v-else-if="listError" :message="listError" @retry="loadList" />
      <EmptyState v-else-if="!list.length" :title="$t('common.noEntries')" />
      <ul v-else class="divide-y divide-slate-100">
        <li v-for="rec in list" :key="rec.id" class="flex items-center gap-3 py-3 text-sm">
          <span class="w-28 text-slate-400">{{ formatDate(rec.date) }}</span>
          <span class="font-medium text-slate-800">{{ rec.weight }} kg</span>
          <span class="flex-1 truncate text-slate-500">{{ rec.note }}</span>
          <button class="text-slate-300 hover:text-red-500" @click="remove(rec)">🗑</button>
        </li>
      </ul>
    </div>
  </div>
</template>
