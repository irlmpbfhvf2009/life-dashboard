<script setup lang="ts">
// Secondary navigation inside the English Coach module, grouped by the four
// learning layers. The global sidebar only lists "AI 實驗室"; this is how the
// module's 13 pages stay organized without polluting the app shell.
import { useI18n } from 'vue-i18n'
import {
  Home, Route, BookOpen, MessageSquareQuote, GraduationCap, Target, Clapperboard,
  PenLine, Mic, AlertTriangle, Repeat, BarChart3,
} from 'lucide-vue-next'

const { t } = useI18n()

interface Item { to: string; label: string; icon: typeof Home; exact?: boolean }
interface Group { label: string; items: Item[] }

const ACTIVE = '!bg-brand-500 !text-white'

const groups: Group[] = [
  { label: '', items: [{ to: '/ai/english', label: 'ec.nav.home', icon: Home, exact: true }] },
  {
    label: 'ec.nav.foundation',
    items: [
      { to: '/ai/english/path', label: 'ec.nav.path', icon: Route },
      { to: '/ai/english/vocabulary', label: 'ec.nav.vocab', icon: BookOpen },
      { to: '/ai/english/phrases', label: 'ec.nav.phrases', icon: MessageSquareQuote },
      { to: '/ai/english/grammar', label: 'ec.nav.grammar', icon: GraduationCap },
    ],
  },
  {
    label: 'ec.nav.practice',
    items: [
      { to: '/ai/english/missions', label: 'ec.nav.missions', icon: Target },
      { to: '/ai/english/scenarios', label: 'ec.nav.scenarios', icon: Clapperboard },
      { to: '/ai/english/coach', label: 'ec.nav.coach', icon: PenLine },
    ],
  },
  {
    label: 'ec.nav.speaking',
    items: [{ to: '/ai/english/speaking', label: 'ec.nav.speakingPractice', icon: Mic }],
  },
  {
    label: 'ec.nav.growth',
    items: [
      { to: '/ai/english/mistakes', label: 'ec.nav.mistakes', icon: AlertTriangle },
      { to: '/ai/english/review', label: 'ec.nav.review', icon: Repeat },
      { to: '/ai/english/progress', label: 'ec.nav.progress', icon: BarChart3 },
    ],
  },
]
</script>

<template>
  <nav class="mb-6 flex flex-wrap items-center gap-x-1 gap-y-2">
    <template v-for="(group, gi) in groups" :key="gi">
      <!-- Section label (not a link): a divider + muted heading make it read as a group title. -->
      <span v-if="group.label" class="ml-1.5 mr-1 flex shrink-0 cursor-default select-none items-center gap-2 pl-1.5">
        <span class="h-3.5 w-px bg-ink-200" aria-hidden="true" />
        <span class="text-[10px] font-semibold uppercase tracking-wider text-ink-300">{{ t(group.label) }}</span>
      </span>
      <RouterLink
        v-for="item in group.items"
        :key="item.to"
        :to="item.to"
        class="inline-flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm font-medium text-ink-500 transition-colors hover:bg-ink-100"
        :active-class="item.exact ? '' : ACTIVE"
        :exact-active-class="item.exact ? ACTIVE : ''"
      >
        <component :is="item.icon" class="h-3.5 w-3.5" />
        {{ t(item.label) }}
      </RouterLink>
    </template>
  </nav>
</template>
