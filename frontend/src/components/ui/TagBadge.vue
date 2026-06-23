<script setup lang="ts">
defineProps<{ label: string }>()
</script>

<template>
  <span class="badge-gray">{{ label }}</span>
</template>
