<script setup lang="ts">
import { ref } from 'vue'
import { Coins, Sparkles } from 'lucide-vue-next'
import PageHeader from '@/components/ui/PageHeader.vue'
import { gameApi } from '@/api'
import { useWallet } from '@/composables/useWallet'

const SYMBOLS = ['🍒', '🍋', '🔔', '⭐', '7️⃣', '💎']
const MULTIPLIERS = [3, 5, 8, 12, 25, 50]
const BETS = [10, 50, 100]

const { coins, setBalance } = useWallet()

const reels = ref<number[]>([0, 1, 2])
const bet = ref(10)
const spinning = ref(false)
const message = ref('')
const lastPayout = ref<number | null>(null)

const rand = () => Math.floor(Math.random() * SYMBOLS.length)
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function spin() {
  if (spinning.value || coins.value < bet.value) return
  spinning.value = true
  message.value = ''
  lastPayout.value = null
  const anim = setInterval(() => { reels.value = [rand(), rand(), rand()] }, 80)
  try {
    const res = await gameApi.spin(bet.value)
    await sleep(650)
    clearInterval(anim)
    reels.value = res.reels
    setBalance(res.balance)
    lastPayout.value = res.payout
    message.value = res.payout > res.bet
      ? `🎉 中獎！+${res.payout - res.bet}`
      : res.payout === res.bet
        ? '🙂 回本'
        : `😵 沒中，-${res.bet}`
  } catch {
    clearInterval(anim)
    message.value = '餘額不足或發生錯誤'
  } finally {
    spinning.value = false
  }
}
</script>

<template>
  <div class="mx-auto max-w-xl">
    <PageHeader eyebrow="Game" title="遊戲" subtitle="用遊戲幣玩玩看（純學習用，不涉及真實金錢）。" />

    <!-- Balance -->
    <div class="card-cute mb-5 flex items-center justify-between p-5">
      <span class="text-sm text-ink-500">我的遊戲幣</span>
      <span class="inline-flex items-center gap-1.5 rounded-full bg-amber-400/90 px-4 py-1.5 text-lg font-bold text-white shadow-sm">
        <Coins class="h-5 w-5" /> {{ coins.toLocaleString() }}
      </span>
    </div>

    <!-- Slot machine -->
    <div class="card-cute overflow-hidden p-6">
      <h3 class="mb-4 flex items-center justify-center gap-2 text-lg font-bold text-ink-900">
        <Sparkles class="h-5 w-5 text-amber-500" /> 幸運老虎機
      </h3>

      <div class="mx-auto mb-5 grid max-w-xs grid-cols-3 gap-3">
        <div
          v-for="(r, i) in reels" :key="i"
          class="flex aspect-square items-center justify-center rounded-2xl border-2 border-amber-300/60 bg-amber-50 text-5xl shadow-inner dark:bg-amber-500/10"
          :class="spinning ? 'animate-pulse' : ''"
        >
          {{ SYMBOLS[r] }}
        </div>
      </div>

      <p class="mb-4 h-6 text-center text-sm font-semibold"
        :class="(lastPayout ?? 0) > bet ? 'text-emerald-600 dark:text-emerald-400' : 'text-ink-500'">
        {{ message }}
      </p>

      <!-- Bet selector -->
      <div class="mb-4 flex items-center justify-center gap-2">
        <span class="text-sm text-ink-500">下注</span>
        <button
          v-for="b in BETS" :key="b"
          class="rounded-xl border px-4 py-1.5 text-sm font-semibold transition-colors"
          :class="bet === b ? 'border-amber-500 bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300' : 'border-ink-200 text-ink-600'"
          :disabled="spinning"
          @click="bet = b"
        >{{ b }}</button>
      </div>

      <button
        class="w-full rounded-2xl bg-gradient-to-r from-amber-400 to-orange-500 py-3 text-base font-bold text-white shadow-sm transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
        :disabled="spinning || coins < bet"
        @click="spin"
      >
        {{ spinning ? '轉動中…' : coins < bet ? '遊戲幣不足' : `轉動（-${bet}）` }}
      </button>

      <!-- Payout table -->
      <div class="mt-5 rounded-2xl bg-ink-50 p-3">
        <p class="mb-2 text-2xs font-semibold text-ink-500">三個相同的賠率（兩個相同回本）</p>
        <div class="grid grid-cols-3 gap-2 text-center text-sm sm:grid-cols-6">
          <div v-for="(s, i) in SYMBOLS" :key="i">
            <span class="text-xl">{{ s }}</span>
            <span class="block text-2xs text-ink-400">×{{ MULTIPLIERS[i] }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
