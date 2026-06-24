<script setup lang="ts">
import { ref } from 'vue'
import { gameApi } from '@/api'
import { useWallet } from '@/composables/useWallet'
import { useAuthStore } from '@/stores/auth'

const SYMBOLS = ['🍒', '🍋', '🔔', '⭐', '7️⃣', '💎']
const MULTIPLIERS = [3, 5, 8, 12, 25, 50]
const BETS = [10, 50, 100, 500]

const auth = useAuthStore()
const { coins, setBalance } = useWallet()

const reels = ref<number[]>([0, 1, 2])
const bet = ref(10)
const spinning = ref(false)
const message = ref('')
const win = ref(false)

const rand = () => Math.floor(Math.random() * SYMBOLS.length)
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function spin() {
  if (spinning.value || !auth.isAuthenticated || coins.value < bet.value) return
  spinning.value = true
  message.value = ''
  win.value = false
  const anim = setInterval(() => { reels.value = [rand(), rand(), rand()] }, 70)
  try {
    const res = await gameApi.spin(bet.value)
    await sleep(700)
    clearInterval(anim)
    reels.value = res.reels
    setBalance(res.balance)
    win.value = res.payout > res.bet
    message.value = res.payout > res.bet
      ? `🎉 大獎！贏得 ${res.payout - res.bet}`
      : res.payout === res.bet ? '🙂 回本' : `差一點，-${res.bet}`
  } catch {
    clearInterval(anim)
    message.value = '餘額不足或無遊戲權限'
  } finally {
    spinning.value = false
  }
}
</script>

<template>
  <div class="rounded-2xl bg-gradient-to-b from-[#1b2a4a] to-[#0f1a30] p-6 ring-1 ring-amber-400/20">
    <h3 class="mb-4 text-center text-lg font-bold tracking-wide text-amber-300">🎰 幸運老虎機</h3>

    <div class="mx-auto mb-4 grid max-w-sm grid-cols-3 gap-3">
      <div
        v-for="(r, i) in reels" :key="i"
        class="flex aspect-square items-center justify-center rounded-xl border-2 border-amber-400/40 bg-[#0b1220] text-5xl shadow-inner"
        :class="spinning ? 'animate-pulse' : ''"
      >{{ SYMBOLS[r] }}</div>
    </div>

    <p class="mb-3 h-6 text-center text-sm font-bold" :class="win ? 'text-amber-300' : 'text-white/60'">{{ message }}</p>

    <div class="mb-3 flex flex-wrap items-center justify-center gap-2">
      <span class="text-sm text-white/60">下注</span>
      <button
        v-for="b in BETS" :key="b"
        class="rounded-lg px-3 py-1.5 text-sm font-bold transition-colors"
        :class="bet === b ? 'bg-amber-400 text-[#0f1a30]' : 'bg-white/10 text-white/70 hover:bg-white/20'"
        :disabled="spinning" @click="bet = b"
      >{{ b }}</button>
    </div>

    <button
      class="w-full rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 py-3 text-base font-extrabold text-[#0f1a30] shadow-lg transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
      :disabled="spinning || !auth.isAuthenticated || coins < bet"
      @click="spin"
    >
      {{ !auth.isAuthenticated ? '請先登入' : spinning ? '轉動中…' : coins < bet ? '遊戲幣不足' : `轉動（-${bet}）` }}
    </button>

    <div class="mt-4 grid grid-cols-6 gap-1 text-center">
      <div v-for="(s, i) in SYMBOLS" :key="i" class="rounded-lg bg-white/5 py-1.5">
        <span class="text-lg">{{ s }}</span>
        <span class="block text-[10px] text-amber-300/80">×{{ MULTIPLIERS[i] }}</span>
      </div>
    </div>
  </div>
</template>
