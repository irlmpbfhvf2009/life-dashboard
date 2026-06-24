<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { Coins, LogOut, ArrowLeft } from 'lucide-vue-next'
import { useAuthStore } from '@/stores/auth'
import { useWallet } from '@/composables/useWallet'
import SlotMachine from '@/components/casino/SlotMachine.vue'

const auth = useAuthStore()
const { coins, refresh } = useWallet()

const CATEGORIES = [
  { key: 'hot', label: '热门', emoji: '🔥' },
  { key: 'board', label: '棋牌', emoji: '♟️' },
  { key: 'esports', label: '电竞', emoji: '🎮' },
  { key: 'sports', label: '体育', emoji: '🏀' },
  { key: 'live', label: '真人', emoji: '🎴' },
  { key: 'electronic', label: '电子', emoji: '🎰' },
  { key: 'fishing', label: '捕鱼', emoji: '🐟' },
  { key: 'lottery', label: '彩票', emoji: '🎫' },
  { key: 'animal', label: '动物', emoji: '🐓' },
  { key: 'promo', label: '優惠活動', emoji: '🎁' },
  { key: 'vip', label: 'VIP', emoji: '⭐' },
]
const activeCat = ref('electronic')

// Placeholder game tiles for flavour.
const TILES = ['农庄争霸', '凤凰传奇', '动物王国', '亚瑟王', '超级巨星', 'Candy Dreams', '三重辣椒', 'Fruit Nova']

const email = ref('')
const password = ref('')
const mode = ref<'login' | 'register'>('login')
const authError = ref('')
const authLoading = ref(false)

async function submit() {
  if (!email.value || !password.value) return
  authError.value = ''
  authLoading.value = true
  try {
    if (mode.value === 'register') {
      await auth.registerWithEmail(email.value.split('@')[0] || 'player', email.value, password.value)
    } else {
      await auth.loginWithEmail(email.value, password.value)
    }
    await refresh()
    email.value = ''
    password.value = ''
  } catch {
    authError.value = auth.error || '登入失敗'
  } finally {
    authLoading.value = false
  }
}
async function logout() {
  await auth.logout()
}
onMounted(() => { if (auth.isAuthenticated) refresh() })
</script>

<template>
  <div class="min-h-screen bg-[#0a1426] text-white">
    <!-- Top bar -->
    <header class="sticky top-0 z-20 bg-[#0e1c38] shadow-lg">
      <div class="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3">
        <span class="text-3xl font-black tracking-tight text-white">K36<span class="text-amber-400">.</span></span>
        <nav class="flex flex-1 gap-1 overflow-x-auto">
          <button
            v-for="c in CATEGORIES" :key="c.key"
            class="flex shrink-0 flex-col items-center rounded-lg px-3 py-1.5 text-xs transition-colors"
            :class="activeCat === c.key ? 'bg-white/10 text-amber-300' : 'text-white/70 hover:text-white'"
            @click="activeCat = c.key"
          >
            <span class="text-lg leading-none">{{ c.emoji }}</span>
            <span class="mt-0.5">{{ c.label }}</span>
          </button>
        </nav>
      </div>

      <!-- Account bar -->
      <div class="bg-[#0a1426]/60 px-4 py-2">
        <div class="mx-auto flex max-w-6xl flex-wrap items-center gap-2">
          <template v-if="!auth.isAuthenticated">
            <input v-model="email" type="email" placeholder="電子郵件" class="w-44 rounded bg-white px-3 py-1.5 text-sm text-ink-900 placeholder:text-ink-400" />
            <input v-model="password" type="password" placeholder="密碼" class="w-36 rounded bg-white px-3 py-1.5 text-sm text-ink-900 placeholder:text-ink-400" @keyup.enter="submit" />
            <button class="rounded bg-amber-400 px-4 py-1.5 text-sm font-bold text-[#0f1a30] disabled:opacity-50" :disabled="authLoading" @click="mode = 'login'; submit()">玩家登入</button>
            <button class="rounded border border-amber-400/60 px-4 py-1.5 text-sm font-bold text-amber-300 disabled:opacity-50" :disabled="authLoading" @click="mode = 'register'; submit()">免費註冊</button>
            <span v-if="authError" class="text-xs text-rose-400">{{ authError }}</span>
            <span class="ml-auto text-2xs text-white/40">純學習用 · 僅 Email 註冊</span>
          </template>
          <template v-else>
            <span class="inline-flex items-center gap-1.5 rounded-full bg-amber-400 px-3 py-1 text-sm font-bold text-[#0f1a30]">
              <Coins class="h-4 w-4" /> {{ coins.toLocaleString() }}
            </span>
            <span class="truncate text-sm text-white/80">{{ auth.email }}</span>
            <button class="ml-auto inline-flex items-center gap-1 text-sm text-white/60 hover:text-white" @click="logout">
              <LogOut class="h-4 w-4" /> 登出
            </button>
            <RouterLink v-if="auth.isStudio" to="/" class="inline-flex items-center gap-1 text-sm text-amber-300 hover:text-amber-200">
              <ArrowLeft class="h-4 w-4" /> 工作台
            </RouterLink>
          </template>
        </div>
      </div>
    </header>

    <main class="mx-auto max-w-6xl px-4 py-6">
      <!-- Banner + jackpot -->
      <div class="mb-6 flex flex-col items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#1b2a4a] via-[#22386a] to-[#1b2a4a] py-8 ring-1 ring-amber-400/20">
        <p class="text-sm text-amber-300/80">奖池累积</p>
        <p class="font-mono text-4xl font-black tracking-widest text-amber-300">30,245,457</p>
      </div>

      <!-- Electronic = working slot machine -->
      <template v-if="activeCat === 'electronic'">
        <h2 class="mb-3 text-lg font-bold">🎰 电子 · 老虎機</h2>
        <div class="grid gap-5 lg:grid-cols-2">
          <SlotMachine />
          <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-2">
            <div v-for="t in TILES" :key="t" class="flex aspect-[4/3] flex-col items-center justify-center rounded-xl bg-gradient-to-br from-[#1b2a4a] to-[#0f1a30] text-center ring-1 ring-white/10">
              <span class="text-2xl">🎲</span>
              <span class="mt-1 px-2 text-xs text-white/70">{{ t }}</span>
              <span class="mt-1 text-[10px] text-white/30">敬請期待</span>
            </div>
          </div>
        </div>
      </template>

      <!-- Other categories: placeholder -->
      <template v-else>
        <h2 class="mb-3 text-lg font-bold">{{ CATEGORIES.find((c) => c.key === activeCat)?.label }}</h2>
        <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          <div v-for="n in 8" :key="n" class="flex aspect-[4/3] flex-col items-center justify-center rounded-xl bg-gradient-to-br from-[#1b2a4a] to-[#0f1a30] text-center ring-1 ring-white/10">
            <span class="text-2xl">🎮</span>
            <span class="mt-1 text-[10px] text-white/30">敬請期待</span>
          </div>
        </div>
      </template>

      <p class="mt-8 text-center text-2xs text-white/30">本娛樂城為進修練習用途，使用虛擬遊戲幣，不涉及任何真實金錢交易。</p>
    </main>
  </div>
</template>
