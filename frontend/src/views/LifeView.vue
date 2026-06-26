<script setup lang="ts">
import { ref } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { Sparkles } from 'lucide-vue-next'
import PageHeader from '@/components/ui/PageHeader.vue'
import TodoPanel from '@/components/life/TodoPanel.vue'
import HabitPanel from '@/components/life/HabitPanel.vue'
import MoodPanel from '@/components/life/MoodPanel.vue'
import FinancePanel from '@/components/finance/FinancePanel.vue'

const { t } = useI18n()
const route = useRoute()

const tabs = ['todos', 'habits', 'mood', 'finance'] as const
type Tab = (typeof tabs)[number]
// Allow deep-linking a tab via ?tab= (e.g. the old /finance route redirects here).
const initial = tabs.includes(route.query.tab as Tab) ? (route.query.tab as Tab) : 'todos'
const activeTab = ref<Tab>(initial)
</script>

<template>
  <PageHeader :icon="Sparkles" :eyebrow="t('life.eyebrow')" :title="t('life.title')" :subtitle="t('life.subtitle')" />

  <div class="mb-5 inline-flex rounded-2xl bg-ink-100 p-1">
    <button
      v-for="tab in tabs" :key="tab"
      class="rounded-xl px-4 py-1.5 text-sm font-medium transition-colors"
      :class="activeTab === tab ? 'bg-surface text-brand-700 shadow-card' : 'text-ink-500 hover:text-ink-700'"
      @click="activeTab = tab"
    >{{ t('life.tabs.' + tab) }}</button>
  </div>

  <TodoPanel v-if="activeTab === 'todos'" />
  <HabitPanel v-else-if="activeTab === 'habits'" />
  <MoodPanel v-else-if="activeTab === 'mood'" />
  <FinancePanel v-else />
</template>
