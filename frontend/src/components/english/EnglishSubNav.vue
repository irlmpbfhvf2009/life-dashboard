<script setup lang="ts">
// Secondary navigation inside the English Coach module, grouped by the four
// learning layers. The global sidebar only lists "AI 實驗室"; this is how the
// module's 13 pages stay organized without polluting the app shell.
import {
  Home, Route, BookOpen, MessageSquareQuote, GraduationCap, Target, Clapperboard,
  PenLine, Mic, AlertTriangle, Repeat, BarChart3,
} from 'lucide-vue-next'

interface Item { to: string; label: string; icon: typeof Home; exact?: boolean }
interface Group { label: string; items: Item[] }

const ACTIVE = '!bg-brand-500 !text-white'

const groups: Group[] = [
  { label: '', items: [{ to: '/ai/english', label: '首頁', icon: Home, exact: true }] },
  {
    label: '基礎學習',
    items: [
      { to: '/ai/english/path', label: '學習路徑', icon: Route },
      { to: '/ai/english/vocabulary', label: '單字', icon: BookOpen },
      { to: '/ai/english/phrases', label: '句型', icon: MessageSquareQuote },
      { to: '/ai/english/grammar', label: '文法', icon: GraduationCap },
    ],
  },
  {
    label: 'AI 練習',
    items: [
      { to: '/ai/english/missions', label: '每日任務', icon: Target },
      { to: '/ai/english/scenarios', label: '情境練習', icon: Clapperboard },
      { to: '/ai/english/coach', label: '句子修正', icon: PenLine },
    ],
  },
  {
    label: '口說',
    items: [{ to: '/ai/english/speaking', label: '口說練習', icon: Mic }],
  },
  {
    label: '複習成長',
    items: [
      { to: '/ai/english/mistakes', label: '常錯庫', icon: AlertTriangle },
      { to: '/ai/english/review', label: '複習', icon: Repeat },
      { to: '/ai/english/progress', label: '學習進度', icon: BarChart3 },
    ],
  },
]
</script>

<template>
  <nav class="mb-6 flex items-center gap-1 overflow-x-auto pb-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
    <template v-for="(group, gi) in groups" :key="gi">
      <span v-if="group.label" class="ml-2 mr-1 shrink-0 text-[11px] font-semibold uppercase tracking-wide text-ink-300">{{ group.label }}</span>
      <RouterLink
        v-for="item in group.items"
        :key="item.to"
        :to="item.to"
        class="inline-flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm font-medium text-ink-500 transition-colors hover:bg-ink-100"
        :active-class="item.exact ? '' : ACTIVE"
        :exact-active-class="item.exact ? ACTIVE : ''"
      >
        <component :is="item.icon" class="h-3.5 w-3.5" />
        {{ item.label }}
      </RouterLink>
    </template>
  </nav>
</template>
