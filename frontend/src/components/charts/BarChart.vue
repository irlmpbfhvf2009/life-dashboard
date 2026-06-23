<script setup lang="ts">
import { Bar } from 'vue-chartjs'
import type { ChartData, ChartOptions } from 'chart.js'
import './registerCharts'

defineProps<{ data: ChartData<'bar'>; options?: ChartOptions<'bar'> }>()

const defaults: ChartOptions<'bar'> = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { display: false } },
  scales: { y: { beginAtZero: true } },
}
</script>

<template>
  <div class="relative h-64">
    <Bar :data="data" :options="{ ...defaults, ...options }" />
  </div>
</template>
