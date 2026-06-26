<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import {
  Users, Search, UserPlus, Check, X, Clock, Trash2, ShieldCheck,
  HeartPulse, Smile, Sparkles, RefreshCw,
} from 'lucide-vue-next'
import PageHeader from '@/components/ui/PageHeader.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import { socialApi } from '@/api'
import type { FriendRequest, SocialPrivacy, SocialUser } from '@/types'

const router = useRouter()

type Tab = 'friends' | 'discover' | 'requests' | 'privacy'
const tab = ref<Tab>('friends')

const friends = ref<SocialUser[]>([])
const incoming = ref<FriendRequest[]>([])
const outgoing = ref<FriendRequest[]>([])
const privacy = ref<SocialPrivacy>({ shareHealth: false, shareMood: false, shareLife: false })

const searchQuery = ref('')
const searchResults = ref<SocialUser[]>([])
const searching = ref(false)
const loading = ref(false)
const error = ref('')
const busy = ref<number | null>(null)
const savingPrivacy = ref(false)

const incomingCount = computed(() => incoming.value.length)

async function loadAll() {
  loading.value = true
  error.value = ''
  try {
    const [f, inc, out, priv] = await Promise.all([
      socialApi.friends(),
      socialApi.incoming(),
      socialApi.outgoing(),
      socialApi.getPrivacy(),
    ])
    friends.value = f
    incoming.value = inc
    outgoing.value = out
    privacy.value = priv
  } catch (e) {
    error.value = (e as Error).message || '載入失敗'
  } finally {
    loading.value = false
  }
}
onMounted(loadAll)

let searchTimer: ReturnType<typeof setTimeout> | null = null
function onSearchInput() {
  if (searchTimer) clearTimeout(searchTimer)
  const q = searchQuery.value.trim()
  if (q.length < 2) {
    searchResults.value = []
    searching.value = false
    return
  }
  searching.value = true
  searchTimer = setTimeout(runSearch, 350)
}
async function runSearch() {
  const q = searchQuery.value.trim()
  if (q.length < 2) return
  try {
    searchResults.value = await socialApi.search(q)
  } catch (e) {
    error.value = (e as Error).message
  } finally {
    searching.value = false
  }
}

function avatarText(u: { displayName: string | null; email: string }) {
  return (u.displayName || u.email || '?').charAt(0).toUpperCase()
}

async function withBusy(id: number, fn: () => Promise<void>) {
  busy.value = id
  error.value = ''
  try {
    await fn()
    await loadAll()
    if (tab.value === 'discover') await runSearch()
  } catch (e) {
    error.value = (e as Error).message
  } finally {
    busy.value = null
  }
}

const sendRequest = (u: SocialUser) => withBusy(u.userId, () => socialApi.sendRequest(u.userId))
const accept = (r: FriendRequest) => withBusy(r.requestId, () => socialApi.accept(r.requestId))
const decline = (r: FriendRequest) => withBusy(r.requestId, () => socialApi.decline(r.requestId))
const unfriend = (u: SocialUser) => {
  if (!confirm(`確定要移除好友「${u.displayName || u.email}」嗎？`)) return
  return withBusy(u.userId, () => socialApi.removeFriend(u.userId))
}

function openProfile(u: SocialUser) {
  router.push({ name: 'social-profile', params: { userId: u.userId } })
}

async function savePrivacy() {
  savingPrivacy.value = true
  error.value = ''
  try {
    privacy.value = await socialApi.updatePrivacy(privacy.value)
  } catch (e) {
    error.value = (e as Error).message
  } finally {
    savingPrivacy.value = false
  }
}

const privacyItems = computed(() => [
  { key: 'shareHealth' as const, label: '健康減脂', desc: '體重趨勢、最新體重與近期飲食', icon: HeartPulse },
  { key: 'shareMood' as const, label: '心情日記', desc: '近 30 天心情紀錄與平均分數', icon: Smile },
  { key: 'shareLife' as const, label: '待辦 / 生活', desc: '待辦完成狀況與今日進度', icon: Sparkles },
])

const tabs: { key: Tab; label: string }[] = [
  { key: 'friends', label: '好友' },
  { key: 'discover', label: '探索' },
  { key: 'requests', label: '邀請' },
  { key: 'privacy', label: '隱私設定' },
]
</script>

<template>
  <div>
    <PageHeader :icon="Users" eyebrow="Social" title="社交" subtitle="加好友、互相查看分享的生活資料，自己決定要公開哪些。">
      <template #actions>
        <button class="btn-secondary btn-sm gap-1.5" :disabled="loading" @click="loadAll">
          <RefreshCw class="h-3.5 w-3.5" :class="loading ? 'animate-spin' : ''" /> 重新整理
        </button>
      </template>
    </PageHeader>

    <p v-if="error" class="mb-4 rounded-xl bg-rose-500/10 px-4 py-2.5 text-sm text-rose-600 dark:text-rose-300">{{ error }}</p>

    <!-- Tabs -->
    <div class="mb-6 flex flex-wrap gap-1.5 rounded-xl bg-ink-50 p-1">
      <button
        v-for="t in tabs"
        :key="t.key"
        class="relative rounded-lg px-4 py-1.5 text-sm font-medium transition-colors"
        :class="tab === t.key ? 'bg-surface text-ink-900 shadow-card' : 'text-ink-500 hover:text-ink-700'"
        @click="tab = t.key"
      >
        {{ t.label }}
        <span
          v-if="t.key === 'requests' && incomingCount"
          class="ml-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-2xs font-bold text-white"
        >{{ incomingCount }}</span>
      </button>
    </div>

    <!-- Friends -->
    <section v-if="tab === 'friends'" class="space-y-2.5">
      <div
        v-for="u in friends"
        :key="u.userId"
        class="card card-hover flex items-center gap-3 p-4"
      >
        <button class="flex min-w-0 flex-1 items-center gap-3 text-left" @click="openProfile(u)">
          <img v-if="u.photoUrl" :src="u.photoUrl" alt="" class="h-10 w-10 rounded-xl object-cover" referrerpolicy="no-referrer" />
          <span v-else class="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-100 text-sm font-semibold text-brand-700">{{ avatarText(u) }}</span>
          <div class="min-w-0">
            <p class="truncate font-medium text-ink-800">{{ u.displayName || '—' }}</p>
            <p class="truncate text-xs text-ink-400">{{ u.email }}</p>
          </div>
        </button>
        <button class="btn-secondary btn-sm" @click="openProfile(u)">查看</button>
        <button class="btn-icon h-8 w-8 rounded-lg text-ink-400 hover:bg-rose-500/10 hover:text-rose-500" :disabled="busy === u.userId" title="移除好友" @click="unfriend(u)">
          <Trash2 class="h-4 w-4" />
        </button>
      </div>
      <EmptyState v-if="!friends.length && !loading" :icon="Users" title="還沒有好友" description="到「探索」分頁搜尋並送出好友邀請吧。" />
    </section>

    <!-- Discover / search -->
    <section v-else-if="tab === 'discover'" class="space-y-4">
      <div class="relative">
        <Search class="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
        <input
          v-model="searchQuery"
          type="text"
          placeholder="搜尋名稱或 Email（至少 2 個字）"
          class="w-full rounded-xl border border-ink-200 bg-surface py-2.5 pl-10 pr-4 text-sm focus:border-brand-400 focus:outline-none"
          @input="onSearchInput"
        />
      </div>

      <p v-if="searching" class="text-sm text-ink-400">搜尋中…</p>
      <div v-else class="space-y-2.5">
        <div v-for="u in searchResults" :key="u.userId" class="card flex items-center gap-3 p-4">
          <img v-if="u.photoUrl" :src="u.photoUrl" alt="" class="h-10 w-10 rounded-xl object-cover" referrerpolicy="no-referrer" />
          <span v-else class="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-100 text-sm font-semibold text-brand-700">{{ avatarText(u) }}</span>
          <div class="min-w-0 flex-1">
            <p class="truncate font-medium text-ink-800">{{ u.displayName || '—' }}</p>
            <p class="truncate text-xs text-ink-400">{{ u.email }}</p>
          </div>
          <button v-if="u.relation === 'FRIEND'" class="btn-secondary btn-sm" @click="openProfile(u)">查看</button>
          <span v-else-if="u.relation === 'REQUEST_SENT'" class="inline-flex items-center gap-1 text-xs text-ink-400"><Clock class="h-3.5 w-3.5" /> 已送出</span>
          <span v-else-if="u.relation === 'REQUEST_RECEIVED'" class="inline-flex items-center gap-1 text-xs text-brand-600">已邀請你</span>
          <button v-else class="btn-primary btn-sm gap-1" :disabled="busy === u.userId" @click="sendRequest(u)">
            <UserPlus class="h-3.5 w-3.5" /> 加好友
          </button>
        </div>
        <EmptyState
          v-if="searchQuery.trim().length >= 2 && !searchResults.length"
          :icon="Search" title="找不到使用者" description="換個名稱或 Email 試試。"
        />
        <p v-else-if="searchQuery.trim().length < 2" class="px-1 text-sm text-ink-400">輸入至少 2 個字開始搜尋。</p>
      </div>
    </section>

    <!-- Requests -->
    <section v-else-if="tab === 'requests'" class="space-y-6">
      <div>
        <h3 class="section-title mb-3">收到的邀請</h3>
        <div class="space-y-2.5">
          <div v-for="r in incoming" :key="r.requestId" class="card flex items-center gap-3 p-4">
            <img v-if="r.user.photoUrl" :src="r.user.photoUrl" alt="" class="h-10 w-10 rounded-xl object-cover" referrerpolicy="no-referrer" />
            <span v-else class="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-100 text-sm font-semibold text-brand-700">{{ avatarText(r.user) }}</span>
            <div class="min-w-0 flex-1">
              <p class="truncate font-medium text-ink-800">{{ r.user.displayName || '—' }}</p>
              <p class="truncate text-xs text-ink-400">{{ r.user.email }}</p>
            </div>
            <button class="btn-primary btn-sm gap-1" :disabled="busy === r.requestId" @click="accept(r)"><Check class="h-3.5 w-3.5" /> 接受</button>
            <button class="btn-icon h-8 w-8 rounded-lg text-ink-400 hover:bg-rose-500/10 hover:text-rose-500" :disabled="busy === r.requestId" title="拒絕" @click="decline(r)"><X class="h-4 w-4" /></button>
          </div>
          <EmptyState v-if="!incoming.length && !loading" :icon="UserPlus" title="沒有新的邀請" description="有人加你好友時會出現在這裡。" />
        </div>
      </div>
      <div v-if="outgoing.length">
        <h3 class="section-title mb-3">已送出的邀請</h3>
        <div class="space-y-2.5">
          <div v-for="r in outgoing" :key="r.requestId" class="card flex items-center gap-3 p-4">
            <img v-if="r.user.photoUrl" :src="r.user.photoUrl" alt="" class="h-10 w-10 rounded-xl object-cover" referrerpolicy="no-referrer" />
            <span v-else class="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-100 text-sm font-semibold text-brand-700">{{ avatarText(r.user) }}</span>
            <div class="min-w-0 flex-1">
              <p class="truncate font-medium text-ink-800">{{ r.user.displayName || '—' }}</p>
              <p class="truncate text-xs text-ink-400">{{ r.user.email }}</p>
            </div>
            <span class="inline-flex items-center gap-1 text-xs text-ink-400"><Clock class="h-3.5 w-3.5" /> 等待回應</span>
            <button class="btn-ghost btn-sm" :disabled="busy === r.requestId" @click="decline(r)">取消</button>
          </div>
        </div>
      </div>
    </section>

    <!-- Privacy -->
    <section v-else class="max-w-2xl space-y-4">
      <div class="card p-5">
        <div class="mb-4 flex items-start gap-3">
          <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600"><ShieldCheck class="h-5 w-5" /></div>
          <div>
            <h3 class="section-title">分享設定</h3>
            <p class="mt-0.5 text-xs text-ink-400">只有你的好友能看到你開啟的項目。基本檔案（名稱、頭像、加入時間）一律對好友可見；其餘預設隱藏。</p>
          </div>
        </div>
        <div class="space-y-2">
          <label
            v-for="item in privacyItems"
            :key="item.key"
            class="flex cursor-pointer items-center gap-3 rounded-xl border border-ink-100 p-3.5 transition-colors hover:bg-ink-50/60"
          >
            <div class="flex h-9 w-9 items-center justify-center rounded-lg bg-ink-50 text-ink-500"><component :is="item.icon" class="h-4.5 w-4.5" /></div>
            <div class="min-w-0 flex-1">
              <p class="font-medium text-ink-800">{{ item.label }}</p>
              <p class="text-xs text-ink-400">{{ item.desc }}</p>
            </div>
            <input v-model="privacy[item.key]" type="checkbox" class="h-5 w-5 accent-emerald-500" />
          </label>
        </div>
        <div class="mt-5 flex justify-end">
          <button class="btn-primary btn-sm" :disabled="savingPrivacy" @click="savePrivacy">
            {{ savingPrivacy ? '儲存中…' : '儲存設定' }}
          </button>
        </div>
      </div>
    </section>
  </div>
</template>
