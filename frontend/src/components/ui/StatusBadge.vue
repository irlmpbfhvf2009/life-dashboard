<script setup lang="ts">
import { statusMeta, type AppStatus } from '@/config/navigation'
defineProps<{ status: AppStatus }>()
</script>

<template>
  <span class="badge" :class="statusMeta[status].cls">
    <span class="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
    {{ statusMeta[status].label }}
  </span>
</template>
