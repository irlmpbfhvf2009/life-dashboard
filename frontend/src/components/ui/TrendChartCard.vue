<script setup lang="ts">
import { computed } from 'vue'
import { Line } from 'vue-chartjs'
import type { ChartData, ChartOptions } from 'chart.js'
import '@/components/charts/registerCharts'
import { useTheme } from '@/composables/useTheme'

const { theme } = useTheme()

const props = withDefaults(
  defineProps<{
    title?: string
    labels: string[]
    data: number[]
    color?: string
    unit?: string
  }>(),
  { color: '#6366f1', unit: '' },
)

const chartData = computed<ChartData<'line'>>(() => ({
  labels: props.labels,
  datasets: [
    {
      data: props.data,
      borderColor: props.color,
      backgroundColor: (ctx) => {
        const c = ctx.chart.ctx
        const g = c.createLinearGradient(0, 0, 0, 160)
        g.addColorStop(0, props.color + '33')
        g.addColorStop(1, props.color + '00')
        return g
      },
      borderWidth: 2,
      tension: 0.4,
      fill: true,
      pointRadius: 0,
      pointHoverRadius: 4,
    },
  ],
}))

const options = computed<ChartOptions<'line'>>(() => {
  const axis = theme.value === 'dark' ? '#94a3b8' : '#64748b'
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false }, tooltip: { intersect: false, mode: 'index' } },
    scales: {
      x: { grid: { display: false }, ticks: { color: axis, font: { size: 10 } } },
      y: { display: false, grace: '10%' },
    },
  }
})
</script>

<template>
  <div class="card p-5">
    <h3 v-if="title" class="section-title mb-4">{{ title }}</h3>
    <div class="relative h-40">
      <Line :data="chartData" :options="options" />
    </div>
  </div>
</template>
