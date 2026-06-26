<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Target, Flame, ListChecks } from 'lucide-vue-next'
import PageHeader from '@/components/ui/PageHeader.vue'
import SectionCard from '@/components/ui/SectionCard.vue'
import DailyMissionCard from '@/components/english/DailyMissionCard.vue'
import { useEnglishStore } from '@/composables/useEnglishStore'

const { t } = useI18n()
const store = useEnglishStore()

const mission = computed(() => store.mission.value)
const streak = computed(() => store.data.value?.streakDays ?? 0)
const allDone = computed(() =>
  !!mission.value && mission.value.totalCount > 0 && mission.value.completedCount >= mission.value.totalCount,
)
</script>

<template>
  <div>
    <PageHeader eyebrow="AI English" :title="t('ec.nav.missions')" :subtitle="t('ec.mission.sub')" />

    <!-- Summary stats -->
    <div class="mb-6 grid gap-4 sm:grid-cols-2">
      <div class="flex items-center gap-3.5 rounded-2xl border border-ink-200 bg-surface p-5 shadow-card">
        <span class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-orange-500 dark:bg-orange-500/10">
          <Flame class="h-5 w-5" :stroke-width="2" />
        </span>
        <div class="leading-tight">
          <p class="text-2xl font-bold text-ink-800">{{ t('ec.home.streakDays', { n: streak }) }}</p>
          <p class="text-xs text-ink-400">{{ t('ec.home.streak') }} · {{ t('ec.home.keepStreak') }}</p>
        </div>
      </div>
      <div class="flex items-center gap-3.5 rounded-2xl border border-ink-200 bg-surface p-5 shadow-card">
        <span class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-500 dark:bg-brand-500/10">
          <ListChecks class="h-5 w-5" :stroke-width="2" />
        </span>
        <div class="leading-tight">
          <p class="text-2xl font-bold text-ink-800">
            {{ t('ec.home.tasksN', { done: mission?.completedCount ?? 0, total: mission?.totalCount ?? 0 }) }}
          </p>
          <p class="text-xs text-ink-400">{{ t('ec.home.todayProgress') }}</p>
        </div>
      </div>
    </div>

    <!-- All-done banner -->
    <div
      v-if="allDone"
      class="mb-6 flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10"
    >
      <Target class="h-5 w-5 shrink-0" :stroke-width="2" />
      <p class="text-sm font-medium">{{ t('ec.mission.doneN', { done: mission!.completedCount, total: mission!.totalCount }) }} 🎉</p>
    </div>

    <!-- Mission checklist -->
    <DailyMissionCard v-if="mission" :mission="mission" />
    <SectionCard v-else>
      <div class="flex flex-col items-center gap-3 py-8 text-center">
        <div class="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-500 dark:bg-brand-500/10">
          <Target class="h-6 w-6" :stroke-width="1.75" />
        </div>
        <p class="text-sm text-ink-400">{{ t('ec.mission.sub') }}</p>
      </div>
    </SectionCard>
  </div>
</template>
