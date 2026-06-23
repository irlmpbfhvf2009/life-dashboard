<script setup lang="ts">
import { Line } from 'vue-chartjs'
import type { ChartData, ChartOptions } from 'chart.js'
import './registerCharts'

defineProps<{ data: ChartData<'line'>; options?: ChartOptions<'line'> }>()

const defaults: ChartOptions<'line'> = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { display: false } },
  scales: { y: { beginAtZero: false } },
}
</script>

<template>
  <div class="relative h-64">
    <Line :data="data" :options="{ ...defaults, ...options }" />
  </div>
</template>
