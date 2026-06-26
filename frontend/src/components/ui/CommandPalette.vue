<script setup lang="ts">
import type { Component } from 'vue'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { Search, CornerDownLeft, Sun, Moon, LogOut, MessageCircle } from 'lucide-vue-next'
import { navGroups, studioApps } from '@/config/navigation'
import { useAuthStore } from '@/stores/auth'
import { useTheme } from '@/composables/useTheme'
import { useChat } from '@/composables/useChat'
import { useCommandPalette } from '@/composables/useCommandPalette'

interface Cmd { label: string; sub?: string; to?: string; icon: Component; group: string; action?: () => void }

const router = useRouter()
const auth = useAuthStore()
const { theme, toggle: toggleTheme } = useTheme()
const { togglePanel } = useChat()
const { open, hide, toggle } = useCommandPalette()

const actions = computed<Cmd[]>(() => [
  {
    label: theme.value === 'dark' ? '切換到淺色模式' : '切換到深色模式',
    icon: theme.value === 'dark' ? Sun : Moon,
    group: '動作',
    action: toggleTheme,
  },
  { label: '開啟訊息', icon: MessageCircle, group: '動作', action: () => togglePanel() },
  {
    label: '登出',
    icon: LogOut,
    group: '動作',
    action: async () => { await auth.logout(); router.push({ name: 'login' }) },
  },
])

const query = ref('')
const activeIndex = ref(0)
const inputEl = ref<HTMLInputElement | null>(null)
const listEl = ref<HTMLElement | null>(null)
let lastFocused: HTMLElement | null = null

const commands = computed<Cmd[]>(() => {
  const groups: Cmd[] = navGroups
    .filter((g) => (g.requires === 'admin' ? auth.isAdmin : g.requires === 'player' ? auth.isPlayer : true))
    .map((g) => ({ label: g.label, to: g.to, icon: g.icon, group: '導覽' }))
  const apps: Cmd[] = studioApps.map((a) => ({ label: a.name, sub: a.description, to: a.to, icon: a.icon, group: '工具' }))
  return [...groups, ...apps, ...actions.value]
})

const filtered = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (!q) return commands.value
  return commands.value.filter(
    (c) => c.label.toLowerCase().includes(q) || (c.sub?.toLowerCase().includes(q) ?? false),
  )
})

watch(open, (v) => {
  if (v) {
    lastFocused = document.activeElement as HTMLElement | null
    query.value = ''
    activeIndex.value = 0
    nextTick(() => inputEl.value?.focus())
  } else {
    // Return focus to whatever opened the palette (search button / shortcut origin).
    lastFocused?.focus?.()
    lastFocused = null
  }
})
watch(filtered, () => { activeIndex.value = 0 })

function go(c: Cmd | undefined) {
  if (!c) return
  hide()
  if (c.action) c.action()
  else if (c.to) router.push(c.to)
}

function move(delta: number) {
  const n = filtered.value.length
  if (!n) return
  activeIndex.value = (activeIndex.value + delta + n) % n
  nextTick(() => {
    listEl.value?.querySelector<HTMLElement>(`[data-idx="${activeIndex.value}"]`)
      ?.scrollIntoView({ block: 'nearest' })
  })
}

function onListKey(e: KeyboardEvent) {
  // Trap Tab inside the palette — keep focus on the input (arrows drive the list).
  if (e.key === 'Tab') { e.preventDefault(); inputEl.value?.focus(); return }
  if (e.key === 'ArrowDown') { e.preventDefault(); move(1) }
  else if (e.key === 'ArrowUp') { e.preventDefault(); move(-1) }
  else if (e.key === 'Enter') { e.preventDefault(); go(filtered.value[activeIndex.value]) }
  else if (e.key === 'Escape') { e.preventDefault(); hide() }
}

// Global ⌘K / Ctrl+K toggle — this component is mounted once in the shell.
function onGlobalKey(e: KeyboardEvent) {
  if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
    e.preventDefault()
    toggle()
  }
}
onMounted(() => window.addEventListener('keydown', onGlobalKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onGlobalKey))
</script>

<template>
  <Teleport to="body">
    <Transition name="cmdk">
      <div
        v-if="open"
        class="fixed inset-0 z-[60] flex items-start justify-center bg-ink-900/40 px-4 pt-[12vh] backdrop-blur-sm"
        @click.self="hide()"
      >
        <div class="w-full max-w-xl overflow-hidden rounded-2xl border border-ink-200 bg-surface shadow-pop" @keydown="onListKey">
          <div class="flex items-center gap-2.5 border-b border-ink-100 px-4">
            <Search class="h-4 w-4 shrink-0 text-ink-400" />
            <input
              ref="inputEl"
              v-model="query"
              type="text"
              placeholder="搜尋模組與工具…"
              class="w-full bg-transparent py-3.5 text-sm text-ink-800 placeholder:text-ink-400 focus:outline-none"
            />
            <kbd class="shrink-0 rounded-md border border-ink-200 bg-ink-50 px-1.5 py-0.5 text-2xs font-medium text-ink-400">Esc</kbd>
          </div>

          <div ref="listEl" class="max-h-[52vh] overflow-y-auto p-2">
            <button
              v-for="(c, i) in filtered"
              :key="c.group + c.to + i"
              :data-idx="i"
              class="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors"
              :class="i === activeIndex ? 'bg-brand-500/10' : 'hover:bg-ink-50'"
              @mousemove="activeIndex = i"
              @click="go(c)"
            >
              <span
                class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                :class="i === activeIndex ? 'tint-indigo' : 'bg-ink-50 text-ink-400'"
              >
                <component :is="c.icon" class="h-[18px] w-[18px]" :stroke-width="2" />
              </span>
              <span class="min-w-0 flex-1">
                <span class="block truncate text-sm font-medium" :class="i === activeIndex ? 'text-brand-700' : 'text-ink-800'">{{ c.label }}</span>
                <span v-if="c.sub" class="block truncate text-2xs text-ink-400">{{ c.sub }}</span>
              </span>
              <span class="shrink-0 text-2xs text-ink-300">{{ c.group }}</span>
              <CornerDownLeft v-if="i === activeIndex" class="h-3.5 w-3.5 shrink-0 text-brand-500" />
            </button>
            <p v-if="!filtered.length" class="px-3 py-8 text-center text-sm text-ink-400">找不到「{{ query }}」</p>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.cmdk-enter-active,
.cmdk-leave-active { transition: opacity 0.15s ease; }
.cmdk-enter-active > div,
.cmdk-leave-active > div { transition: transform 0.15s ease, opacity 0.15s ease; }
.cmdk-enter-from,
.cmdk-leave-to { opacity: 0; }
.cmdk-enter-from > div,
.cmdk-leave-to > div { opacity: 0; transform: translateY(-8px) scale(0.98); }
</style>
