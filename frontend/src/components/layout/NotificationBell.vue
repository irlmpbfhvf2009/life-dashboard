<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { Bell, UserPlus, Check, X, MessageCircle } from 'lucide-vue-next'
import { socialApi } from '@/api'
import { useChat } from '@/composables/useChat'
import type { FriendRequest } from '@/types'

const router = useRouter()
const { conversations, unreadTotal, openPanel, openConversation } = useChat()

const menuOpen = ref(false)
const requests = ref<FriendRequest[]>([])
const loading = ref(false)

const unreadConvos = computed(() => conversations.value.filter((c) => c.unreadCount > 0).slice(0, 5))
const badge = computed(() => requests.value.length + unreadTotal.value)
const hasAny = computed(() => requests.value.length > 0 || unreadConvos.value.length > 0)

async function loadRequests() {
  loading.value = true
  try {
    requests.value = await socialApi.incoming()
  } catch {
    /* shown as empty */
  } finally {
    loading.value = false
  }
}
onMounted(loadRequests)

function toggle() {
  menuOpen.value = !menuOpen.value
  if (menuOpen.value) loadRequests()
}
function close() { menuOpen.value = false }

async function accept(r: FriendRequest) {
  requests.value = requests.value.filter((x) => x.requestId !== r.requestId)
  try { await socialApi.accept(r.requestId) } catch { await loadRequests() }
}
async function decline(r: FriendRequest) {
  requests.value = requests.value.filter((x) => x.requestId !== r.requestId)
  try { await socialApi.decline(r.requestId) } catch { await loadRequests() }
}
async function openChat(id: number) {
  close()
  await openPanel()
  await openConversation(id)
}
function goSocial() { close(); router.push('/social') }
function avatarText(name?: string | null) { return (name || '?').charAt(0).toUpperCase() }
</script>

<template>
  <div class="relative">
    <button class="btn-icon relative" title="通知" aria-label="通知" @click="toggle">
      <Bell class="h-5 w-5" />
      <span
        v-if="badge"
        class="absolute -right-0.5 -top-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white ring-2 ring-ink-50"
      >{{ badge > 99 ? '99+' : badge }}</span>
    </button>

    <div v-if="menuOpen" class="fixed inset-0 z-[-1]" @click="close" />

    <Transition name="menu">
      <div
        v-if="menuOpen"
        class="absolute right-0 top-12 z-30 w-80 overflow-hidden rounded-2xl border border-ink-200 bg-surface shadow-pop"
      >
        <div class="flex items-center justify-between border-b border-ink-100 px-4 py-3">
          <p class="text-sm font-semibold text-ink-800">通知</p>
          <span v-if="badge" class="badge-brand">{{ badge }}</span>
        </div>

        <div class="max-h-[60vh] overflow-y-auto py-1">
          <!-- Friend requests -->
          <template v-if="requests.length">
            <p class="px-4 pb-1 pt-2 text-2xs font-semibold uppercase tracking-wider text-ink-400">好友邀請</p>
            <div v-for="r in requests" :key="r.requestId" class="flex items-center gap-2.5 px-3 py-2">
              <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-400 to-violet-500 text-xs font-semibold text-white">
                <img v-if="r.user.photoUrl" :src="r.user.photoUrl" alt="" class="h-9 w-9 rounded-xl object-cover" referrerpolicy="no-referrer" />
                <template v-else>{{ avatarText(r.user.displayName || r.user.email) }}</template>
              </span>
              <div class="min-w-0 flex-1">
                <p class="truncate text-sm font-medium text-ink-800">{{ r.user.displayName || r.user.email }}</p>
                <p class="truncate text-2xs text-ink-400">想加你為好友</p>
              </div>
              <button class="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-500/10 text-brand-600 transition-colors hover:bg-brand-500/20" title="接受" aria-label="接受" @click="accept(r)">
                <Check class="h-4 w-4" />
              </button>
              <button class="flex h-8 w-8 items-center justify-center rounded-lg text-ink-400 transition-colors hover:bg-ink-100" title="拒絕" aria-label="拒絕" @click="decline(r)">
                <X class="h-4 w-4" />
              </button>
            </div>
          </template>

          <!-- Unread conversations -->
          <template v-if="unreadConvos.length">
            <p class="px-4 pb-1 pt-2 text-2xs font-semibold uppercase tracking-wider text-ink-400">未讀訊息</p>
            <button
              v-for="c in unreadConvos"
              :key="c.id"
              class="flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors hover:bg-ink-50"
              @click="openChat(c.id)"
            >
              <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-100 text-xs font-semibold text-brand-700">
                <img v-if="c.photoUrl" :src="c.photoUrl" alt="" class="h-9 w-9 rounded-xl object-cover" referrerpolicy="no-referrer" />
                <MessageCircle v-else class="h-4 w-4" />
              </span>
              <div class="min-w-0 flex-1">
                <p class="truncate text-sm font-medium text-ink-800">{{ c.name || '對話' }}</p>
                <p v-if="c.lastMessage" class="truncate text-2xs text-ink-400">{{ c.lastMessage.content }}</p>
              </div>
              <span class="inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-rose-500 px-1 text-2xs font-bold text-white">{{ c.unreadCount }}</span>
            </button>
          </template>

          <p v-if="loading && !hasAny" class="px-4 py-8 text-center text-xs text-ink-400">載入中…</p>
          <div v-else-if="!hasAny" class="flex flex-col items-center gap-2 px-4 py-10 text-center">
            <span class="flex h-11 w-11 items-center justify-center rounded-2xl bg-ink-50 text-ink-300">
              <Bell class="h-5 w-5" :stroke-width="1.75" />
            </span>
            <p class="text-sm text-ink-400">目前沒有新通知</p>
          </div>
        </div>

        <button class="flex w-full items-center justify-center gap-1.5 border-t border-ink-100 py-2.5 text-xs font-medium text-brand-600 hover:bg-ink-50" @click="goSocial">
          <UserPlus class="h-3.5 w-3.5" /> 前往社交
        </button>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.menu-enter-active,
.menu-leave-active { transition: opacity 0.12s ease, transform 0.12s ease; }
.menu-enter-from,
.menu-leave-to { opacity: 0; transform: translateY(-4px); }
</style>
