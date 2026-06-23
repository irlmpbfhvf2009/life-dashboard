<script setup lang="ts">
import { Doughnut } from 'vue-chartjs'
import type { ChartData, ChartOptions } from 'chart.js'
import './registerCharts'

defineProps<{ data: ChartData<'doughnut'>; options?: ChartOptions<'doughnut'> }>()

const defaults: ChartOptions<'doughnut'> = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { position: 'bottom' } },
}
</script>

<template>
  <div class="relative h-64">
    <Doughnut :data="data" :options="{ ...defaults, ...options }" />
  </div>
</template>
