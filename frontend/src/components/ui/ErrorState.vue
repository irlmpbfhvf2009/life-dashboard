<script setup lang="ts">
import { TriangleAlert } from 'lucide-vue-next'
defineProps<{ message: string }>()
defineEmits<{ retry: [] }>()
</script>

<template>
  <div class="flex flex-col items-center justify-center gap-3 rounded-2xl border border-rose-100 bg-rose-50/60 py-12 text-center">
    <TriangleAlert class="h-7 w-7 text-rose-400" :stroke-width="2" />
    <p class="text-sm text-rose-600">{{ message }}</p>
    <button class="btn-secondary btn-sm" @click="$emit('retry')">重新整理</button>
  </div>
</template>
