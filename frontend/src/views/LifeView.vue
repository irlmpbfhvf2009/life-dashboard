<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import PageHeader from '@/components/ui/PageHeader.vue'
import TodoPanel from '@/components/life/TodoPanel.vue'
import MoodPanel from '@/components/life/MoodPanel.vue'

const { t } = useI18n()

const tabs = ['todos', 'mood'] as const
type Tab = (typeof tabs)[number]
const activeTab = ref<Tab>('todos')
</script>

<template>
  <PageHeader :eyebrow="t('life.eyebrow')" :title="t('life.title')" :subtitle="t('life.subtitle')" />

  <div class="mb-5 inline-flex rounded-2xl bg-ink-100 p-1">
    <button
      v-for="tab in tabs" :key="tab"
      class="rounded-xl px-4 py-1.5 text-sm font-medium transition-colors"
      :class="activeTab === tab ? 'bg-surface text-ink-900 shadow-card' : 'text-ink-500 hover:text-ink-700'"
      @click="activeTab = tab"
    >{{ t('life.tabs.' + tab) }}</button>
  </div>

  <TodoPanel v-if="activeTab === 'todos'" />
  <MoodPanel v-else />
</template>
