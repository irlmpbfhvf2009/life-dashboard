<script setup lang="ts">
import type { Component } from 'vue'
defineProps<{ title?: string; icon?: Component; to?: string }>()
</script>

<template>
  <section class="card p-5">
    <header v-if="title || $slots.action" class="mb-4 flex items-center justify-between">
      <div class="flex items-center gap-2.5">
        <component :is="icon" v-if="icon" class="h-4 w-4 text-ink-400" :stroke-width="2" />
        <h3 class="section-title">{{ title }}</h3>
      </div>
      <slot name="action" />
    </header>
    <slot />
  </section>
</template>
