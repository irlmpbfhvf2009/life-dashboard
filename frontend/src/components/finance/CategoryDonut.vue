<script setup lang="ts">
import { computed } from 'vue'
import { Doughnut } from 'vue-chartjs'
import type { ChartData, ChartOptions } from 'chart.js'
import '@/components/charts/registerCharts'
import { formatMoney } from '@/utils/format'

const props = defineProps<{
  /** Category slices, pre-sorted desc by total. */
  items: { category: string; total: number }[]
}>()

// Multi-hue palette — deliberately not red/green so it never clashes with the
// 台股 漲紅跌綠 convention used elsewhere in the studio.
const PALETTE = ['#6366f1', '#0ea5e9', '#f59e0b', '#10b981', '#ec4899', '#8b5cf6', '#14b8a6', '#f43f5e', '#64748b']

const total = computed(() => props.items.reduce((s, i) => s + i.total, 0))

const chartData = computed<ChartData<'doughnut'>>(() => ({
  labels: props.items.map((i) => i.category),
  datasets: [
    {
      data: props.items.map((i) => i.total),
      backgroundColor: props.items.map((_, idx) => PALETTE[idx % PALETTE.length]),
      borderWidth: 0,
      hoverOffset: 6,
    },
  ],
}))

const options: ChartOptions<'doughnut'> = {
  responsive: true,
  maintainAspectRatio: false,
  cutout: '66%',
  plugins: {
    legend: { display: false },
    tooltip: {
      callbacks: {
        label: (ctx) => ` ${ctx.label}：${formatMoney(ctx.parsed)}`,
      },
    },
  },
}

const legend = computed(() =>
  props.items.map((i, idx) => ({
    category: i.category,
    total: i.total,
    pct: total.value ? Math.round((i.total / total.value) * 100) : 0,
    color: PALETTE[idx % PALETTE.length],
  })),
)
</script>

<template>
  <div class="flex flex-col items-center gap-5 sm:flex-row">
    <div class="relative h-44 w-44 shrink-0">
      <Doughnut :data="chartData" :options="options" />
      <div class="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span class="text-xs text-ink-400">總計</span>
        <span class="text-lg font-bold tracking-tight text-ink-900">{{ formatMoney(total) }}</span>
      </div>
    </div>

    <ul class="w-full space-y-2">
      <li v-for="row in legend" :key="row.category" class="flex items-center gap-2.5 text-sm">
        <span class="h-2.5 w-2.5 shrink-0 rounded-full" :style="{ backgroundColor: row.color }" />
        <span class="truncate text-ink-700">{{ row.category }}</span>
        <span class="ml-auto shrink-0 font-medium text-ink-900">{{ formatMoney(row.total) }}</span>
        <span class="w-9 shrink-0 text-right text-xs text-ink-400">{{ row.pct }}%</span>
      </li>
    </ul>
  </div>
</template>
