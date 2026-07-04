<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { ArrowLeft, Volume2, VolumeX, Music, Zap, RotateCw, X } from 'lucide-vue-next'
import { gameApi, type Seth2Buy, type Seth2Round, type SethCell } from '@/api'
import { useWallet } from '@/composables/useWallet'
import { useAuthStore } from '@/stores/auth'
import { useSound } from '@/composables/useSound'
import Seth2Symbol from '@/components/casino/Seth2Symbol.vue'

defineEmits<{ back: [] }>()

const sound = useSound()
onUnmounted(() => { sound.stopMusic(); auto.value = false })

// Pay symbols 0–8 (low→high), 9 = scatter, 10 = multiplier orb.
const SYMBOL_NAMES = ['藍鑽', '綠鑽', '紫寶石', '琥珀', '紅寶石', '神弓', '彎刀', '眼鏡蛇', '荷魯斯之眼']
const TOP_PAY = [0.4, 0.6, 0.9, 1.4, 2.2, 3.5, 6, 10, 15] // 12+ of a kind, × total bet
const SCATTER = 9
const ORB = 10
const BETS = [10, 20, 50, 100, 200]

const BUY_TIERS: { key: Seth2Buy; name: string; mult: number; desc: string; accent: string }[] = [
  { key: 'FREE', name: '免費遊戲', mult: 200, desc: '10 次免費遊戲\n有機會獲得覺醒之力', accent: 'amber' },
  { key: 'AWAKEN', name: '覺醒之力', mult: 500, desc: '必定獲得\n覺醒之力遊戲', accent: 'fuchsia' },
  { key: 'IMMORTAL', name: '不朽覺醒', mult: 2000, desc: '必定掉落 ×500\n且聖甲蟲有機會分裂', accent: 'red' },
]

const auth = useAuthStore()
const { coins, setBalance } = useWallet()

// ---- phases: loading splash → machine lobby → game ----
const phase = ref<'load' | 'lobby' | 'game'>('load')
const loadPct = ref(0)
const machine = ref(0)
const hotMachine = Math.floor(Math.random() * 25) + 1

onMounted(() => {
  const t0 = performance.now()
  const dur = 1600
  const tick = (now: number) => {
    if (phase.value !== 'load') return
    const p = Math.min(1, (now - t0) / dur)
    loadPct.value = Math.round(100 * (1 - Math.pow(1 - p, 2.2)))
    if (p < 1) requestAnimationFrame(tick)
    else setTimeout(() => { if (phase.value === 'load') phase.value = 'lobby' }, 250)
  }
  requestAnimationFrame(tick)
  // rAF pauses in background tabs — make sure the splash always resolves.
  setTimeout(() => { if (phase.value === 'load') { loadPct.value = 100; phase.value = 'lobby' } }, 2600)
})

function pickMachine(n: number) {
  machine.value = n
  phase.value = 'game'
}

// ---- game state ----
const bet = ref(10)
const buyOpen = ref(false)
const turbo = ref(false)
const auto = ref(false)
const spinning = ref(false)
const grid = ref<SethCell[]>(Array.from({ length: 30 }, (_, i) => ({ type: (i * 7 + 3) % 9, value: 0 })))
const frameKey = ref(0)
const highlight = ref<Set<number>>(new Set())
const orbFlash = ref(false)
const multiplierFlash = ref(0)
const winFlash = ref(0)
const boardShake = ref(false)
const awakenedNow = ref(false)

const freeMode = ref(false)
const freeIndex = ref(0)
const freeTotal = ref(0)
const freeSessionWin = ref(0)

// full-screen show-pieces
const freeIntro = ref(0)          // >0 = show "免費遊戲 ×N" splash
const awakenIntro = ref(false)    // show "覺醒之力" splash
const bigWin = ref<{ tier: string } | null>(null)
const shownWin = ref(0)           // count-up value inside the big-win splash
const rain = ref<{ left: number; delay: number; dur: number; size: number }[]>([])

const message = ref('任意位置 8 個同符號即中獎 · 3 個金聖甲蟲觸發免費遊戲')
const lastWin = ref(0)

const spinCost = computed(() => bet.value)
const canSpin = computed(() => auth.isAuthenticated && coins.value >= spinCost.value && !spinning.value)
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const d = (ms: number) => (turbo.value ? Math.round(ms * 0.45) : ms)

function buyCost(mult: number) {
  return bet.value * mult
}

/** Staggered tumble: cells drop in a diagonal wave (per column + row). */
function dropStyle(i: number) {
  const col = i % 6
  const row = Math.floor(i / 6)
  return { animationDelay: `${col * 38 + row * 26}ms` }
}

function countUp(target: number, ms: number) {
  return new Promise<void>((resolve) => {
    const t0 = performance.now()
    const step = (now: number) => {
      const p = Math.min(1, (now - t0) / ms)
      shownWin.value = Math.round(target * (1 - Math.pow(1 - p, 3)))
      if (p < 1) requestAnimationFrame(step)
      else resolve()
    }
    requestAnimationFrame(step)
  })
}

function makeRain() {
  rain.value = Array.from({ length: 26 }, () => ({
    left: 2 + Math.random() * 96,
    delay: Math.random() * 1.4,
    dur: 1.6 + Math.random() * 1.6,
    size: 14 + Math.random() * 14,
  }))
}

async function play(buy: Seth2Buy = 'NONE') {
  buyOpen.value = false
  if (spinning.value || !auth.isAuthenticated) return
  const cost = buy === 'NONE' ? spinCost.value : buyCost(BUY_TIERS.find((t) => t.key === buy)!.mult)
  if (coins.value < cost) {
    message.value = '遊戲幣不足'
    auto.value = false
    return
  }
  spinning.value = true
  message.value = ''
  lastWin.value = 0
  freeSessionWin.value = 0
  winFlash.value = 0
  multiplierFlash.value = 0
  sound.startMusic() // first spin is the user gesture that unlocks audio
  sound.spin()

  let res
  try {
    res = await gameApi.seth2Spin(bet.value, buy)
  } catch {
    message.value = '餘額不足或尚未開通遊戲權限'
    spinning.value = false
    auto.value = false
    return
  }

  for (const round of res.rounds) {
    if (round.type === 'FREE') {
      if (!freeMode.value) {
        freeMode.value = true
        sound.freeSpins()
        freeIntro.value = res.freeSpins
        await sleep(d(1700))
        freeIntro.value = 0
      }
      if (round.awakened && !awakenedNow.value) {
        awakenedNow.value = true
        sound.orb(10)
        awakenIntro.value = true
        await sleep(d(1500))
        awakenIntro.value = false
      }
      freeIndex.value = round.spinIndex
      freeTotal.value = round.spinTotal
    }
    await playRound(round)
    if (round.type === 'FREE') {
      freeSessionWin.value += round.pay
      message.value = `免費遊戲 ${round.spinIndex}/${round.spinTotal} · 累積贏 ${freeSessionWin.value.toLocaleString()}`
    }
  }

  setBalance(res.balance)
  freeMode.value = false
  awakenedNow.value = false
  const net = res.totalPayout - res.cost
  lastWin.value = res.totalPayout
  const ratio = res.totalPayout / res.cost
  message.value = res.totalPayout > 0
    ? `本局贏得 ${res.totalPayout.toLocaleString()}（淨 ${net >= 0 ? '+' : ''}${net.toLocaleString()}）`
    : '差一點，再接再厲'
  if (res.totalPayout > 0) sound.coins(ratio >= 15 ? 16 : 8)

  // Tiered big-win celebration with a coin shower and counting number.
  if (ratio >= 15) {
    bigWin.value = { tier: ratio >= 100 ? 'EPIC WIN' : ratio >= 40 ? 'MEGA WIN' : 'BIG WIN' }
    shownWin.value = 0
    makeRain()
    await countUp(res.totalPayout, d(1400))
    await sleep(d(1100))
    bigWin.value = null
  }
  spinning.value = false

  if (auto.value && buy === 'NONE') {
    await sleep(d(700))
    if (auto.value && !spinning.value && coins.value >= spinCost.value) void play('NONE')
    else auto.value = false
  }
}

async function playRound(round: Seth2Round) {
  for (let i = 0; i < round.tumbles.length; i++) {
    const t = round.tumbles[i]
    grid.value = t.grid
    frameKey.value++
    sound.tumble(i)
    await sleep(d(i === 0 ? 560 : 480)) // settle / drop (wave adds ~250ms)
    if (t.winPositions.length) {
      highlight.value = new Set(t.winPositions)
      winFlash.value = t.pay
      sound.win(t.pay >= bet.value * 5)
      await sleep(d(680))
      highlight.value = new Set()
      winFlash.value = 0
      await sleep(d(120))
    }
  }
  if (round.pay > 0 && round.multiplier > 1) {
    orbFlash.value = true
    multiplierFlash.value = round.multiplier
    boardShake.value = true
    sound.orb(round.multiplier)
    await sleep(d(1000))
    orbFlash.value = false
    multiplierFlash.value = 0
    boardShake.value = false
  }
}

function stepBet(dir: 1 | -1) {
  const i = BETS.indexOf(bet.value)
  bet.value = BETS[Math.min(BETS.length - 1, Math.max(0, i + dir))]
}

function toggleAuto() {
  auto.value = !auto.value
  if (auto.value && !spinning.value) void play('NONE')
}
</script>

<template>
  <!-- ===================== 載入畫面 ===================== -->
  <div v-if="phase === 'load'" class="s2-stage relative overflow-hidden rounded-3xl p-6 ring-1 ring-amber-500/40">
    <div class="s2-dust" aria-hidden="true"><i v-for="n in 10" :key="n" /></div>
    <div class="relative flex min-h-[420px] flex-col items-center justify-center gap-5">
      <div class="s2-sunray h-40 w-40">
        <span class="block h-full w-full drop-shadow-[0_0_24px_rgba(255,200,80,0.5)]"><Seth2Symbol :type="8" /></span>
      </div>
      <div class="text-center">
        <p class="s2-goldtext text-4xl font-black tracking-widest">荷魯斯覺醒</p>
        <p class="mt-1 text-sm font-bold tracking-[0.5em] text-amber-200/70">神 眼 之 力</p>
      </div>
      <div class="w-64">
        <div class="h-2.5 overflow-hidden rounded-full bg-black/50 ring-1 ring-amber-400/40">
          <div class="h-full rounded-full bg-gradient-to-r from-amber-500 via-yellow-300 to-amber-500 transition-[width] duration-100" :style="{ width: loadPct + '%' }" />
        </div>
        <p class="mt-2 text-center font-mono text-sm font-bold text-amber-200">{{ loadPct }}%</p>
      </div>
    </div>
  </div>

  <!-- ===================== 機台選擇大廳 ===================== -->
  <div v-else-if="phase === 'lobby'" class="s2-stage relative overflow-hidden rounded-3xl p-4 ring-1 ring-amber-500/40 sm:p-6">
    <div class="s2-dust" aria-hidden="true"><i v-for="n in 10" :key="n" /></div>
    <div class="relative">
      <div class="mb-4 flex items-center justify-between">
        <button class="inline-flex items-center gap-1 text-sm text-white/60 hover:text-white" @click="$emit('back')">
          <ArrowLeft class="h-4 w-4" /> 大廳
        </button>
        <h3 class="text-center text-lg font-black tracking-wide">
          <span class="s2-goldtext">荷魯斯覺醒</span>
          <span class="ml-1 text-xs font-bold text-amber-200/70">神眼之力</span>
        </h3>
        <span class="inline-flex items-center gap-1.5 rounded-full bg-amber-400/90 px-2.5 py-1 text-xs font-bold text-[#1c0f06]">
          💰 {{ coins.toLocaleString() }}
        </span>
      </div>

      <p class="mb-3 text-center text-xs text-amber-200/60">選擇機台開始遊戲（純氛圍，不影響結果）</p>

      <div class="grid grid-cols-5 gap-2">
        <button
          v-for="n in 25" :key="n"
          class="group flex flex-col items-center rounded-xl bg-white/5 py-2.5 ring-1 transition hover:-translate-y-0.5 hover:bg-amber-400/10"
          :class="n === hotMachine ? 'ring-amber-400/80 shadow-[0_0_18px_rgba(255,190,60,0.25)]' : 'ring-white/10 hover:ring-amber-400/40'"
          @click="pickMachine(n)"
        >
          <span class="grid h-10 w-10 place-items-center rounded-full ring-2" :class="n === hotMachine ? 'bg-amber-400/25 ring-amber-400' : 'bg-black/40 ring-amber-700/50'">
            <span class="block h-7 w-7"><Seth2Symbol :type="9" /></span>
          </span>
          <span class="mt-1 text-sm font-bold" :class="n === hotMachine ? 'text-amber-300' : 'text-amber-100/70'">{{ n }}</span>
          <span v-if="n === hotMachine" class="text-[9px] font-black text-amber-400">HOT</span>
        </button>
      </div>

      <div class="mt-4 flex items-stretch gap-2">
        <div class="flex-1 rounded-xl bg-black/40 p-3 text-xs ring-1 ring-amber-500/20">
          <div class="mb-1.5 flex items-center justify-between font-bold text-amber-200">
            <span>近30日</span><span>免費遊戲最高 <span class="text-amber-400">-</span> 倍</span>
          </div>
          <div class="grid grid-cols-3 gap-y-1 text-white/50">
            <span>日期</span><span class="text-center">總下注</span><span class="text-right">得分率</span>
            <span class="text-amber-300/80">今日</span><span class="text-center">-</span><span class="text-right">-</span>
            <span>昨日</span><span class="text-center">-</span><span class="text-right">-</span>
            <span>近30日</span><span class="text-center">-</span><span class="text-right">-</span>
          </div>
        </div>
        <button
          class="w-28 rounded-xl bg-gradient-to-b from-amber-400 to-amber-600 text-sm font-black text-[#1c0f06] shadow-lg shadow-amber-900/40 transition hover:from-amber-300 active:scale-[0.98]"
          @click="pickMachine(Math.floor(Math.random() * 25) + 1)"
        >自動選台</button>
      </div>
    </div>
  </div>

  <!-- ===================== 遊戲主畫面 ===================== -->
  <div
    v-else
    class="s2-stage relative overflow-hidden rounded-3xl p-4 ring-1 transition-all duration-700 sm:p-5"
    :class="awakenedNow ? 's2-stage-awaken ring-red-500/60' : 'ring-amber-500/40'"
  >
    <div class="s2-dust" aria-hidden="true"><i v-for="n in 10" :key="n" /></div>
    <div v-if="awakenedNow" class="s2-awaken-vignette" aria-hidden="true" />

    <div class="relative">
      <!-- Header -->
      <div class="mb-2 flex items-center justify-between">
        <button class="inline-flex items-center gap-1 text-sm text-white/60 hover:text-white" @click="phase = 'lobby'">
          <ArrowLeft class="h-4 w-4" /> 選台
        </button>
        <h3 class="text-center text-lg font-black tracking-wide">
          <span class="s2-goldtext">荷魯斯覺醒</span>
          <span class="ml-1 text-xs font-bold" :class="awakenedNow ? 'text-red-300' : 'text-amber-200/70'">神眼之力 · NO.{{ machine }}</span>
        </h3>
        <div class="flex items-center gap-1.5">
          <span v-if="freeMode" class="rounded-full px-2.5 py-1 text-xs font-bold" :class="awakenedNow ? 'bg-red-500 text-white' : 'bg-amber-400 text-[#1c0f06]'">
            免費 {{ freeIndex }}/{{ freeTotal }}
          </span>
          <button
            class="rounded-lg p-1.5 text-white/60 transition-colors hover:bg-white/10 hover:text-white"
            :class="{ 'text-amber-300': sound.musicOn.value && !sound.muted.value }"
            :title="sound.musicOn.value ? '背景音樂：開' : '背景音樂：關'"
            @click="sound.toggleMusic()"
          ><Music class="h-4 w-4" /></button>
          <button
            class="rounded-lg p-1.5 text-white/60 transition-colors hover:bg-white/10 hover:text-white"
            :title="sound.muted.value ? '靜音中' : '音效：開'"
            @click="sound.toggleMute()"
          >
            <VolumeX v-if="sound.muted.value" class="h-4 w-4" />
            <Volume2 v-else class="h-4 w-4" />
          </button>
        </div>
      </div>

      <!-- 神明門面 + 購買 -->
      <div class="relative mx-auto h-24 max-w-md sm:h-28">
        <svg viewBox="0 0 400 110" class="absolute inset-0 h-full w-full" aria-hidden="true">
          <defs>
            <linearGradient id="s2g-gold" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#ffe9a0" /><stop offset="100%" stop-color="#8a5a12" /></linearGradient>
            <linearGradient id="s2g-skin" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#e8b98a" /><stop offset="100%" stop-color="#9c6b3e" /></linearGradient>
            <radialGradient id="s2g-blueflame" cx="50%" cy="70%" r="65%"><stop offset="0%" stop-color="#dff6ff" /><stop offset="45%" stop-color="#3fb9ff" /><stop offset="100%" stop-color="rgba(20,60,160,0)" /></radialGradient>
            <radialGradient id="s2g-pinkflame" cx="50%" cy="70%" r="65%"><stop offset="0%" stop-color="#ffe3fb" /><stop offset="45%" stop-color="#e35cff" /><stop offset="100%" stop-color="rgba(120,20,160,0)" /></radialGradient>
          </defs>
          <!-- left god: falcon-headed warrior -->
          <g>
            <path d="M18,110 L26,64 Q28,48 44,44 L58,40 Q70,38 74,26 L82,30 Q80,44 66,50 L86,58 Q96,64 96,80 L96,110 Z" fill="#122642" stroke="#28406b" stroke-width="1.5" />
            <path d="M56,10 Q76,8 82,26 Q84,38 74,44 Q60,48 54,38 Q48,24 56,10 Z" fill="#0d1c33" stroke="#2c4a7a" stroke-width="1.5" />
            <path d="M56,12 Q50,26 56,38 L50,36 Q44,22 50,12 Z" fill="url(#s2g-gold)" opacity="0.9" />
            <path d="M82,26 Q92,28 96,34 L84,34 Z" fill="url(#s2g-gold)" />
            <circle cx="70" cy="24" r="4" fill="#37e2c2" />
            <circle cx="70" cy="24" r="1.6" fill="#04223a" />
            <path d="M30,64 Q54,58 78,64 L78,72 Q54,66 30,72 Z" fill="url(#s2g-gold)" opacity="0.95" />
            <!-- raised hand + blue flame -->
            <path d="M10,58 Q14,50 22,50 L26,58 L18,66 Z" fill="url(#s2g-skin)" />
            <ellipse cx="16" cy="40" rx="13" ry="17" fill="url(#s2g-blueflame)">
              <animate attributeName="ry" values="17;21;17" dur="1.6s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="0.85;1;0.85" dur="1.6s" repeatCount="indefinite" />
            </ellipse>
            <path d="M16,28 Q20,36 16,44 Q12,36 16,28 Z" fill="#cfeeff" opacity="0.9">
              <animate attributeName="opacity" values="0.6;1;0.6" dur="0.9s" repeatCount="indefinite" />
            </path>
          </g>
          <!-- right god: crowned sorceress -->
          <g>
            <path d="M382,110 L376,66 Q374,50 358,46 L344,42 Q330,40 328,28 L318,32 Q320,46 334,52 L316,60 Q304,66 304,82 L304,110 Z" fill="#301a3f" stroke="#553069" stroke-width="1.5" />
            <path d="M346,8 Q328,10 324,28 Q322,40 334,46 Q348,50 354,40 Q358,24 346,8 Z" fill="url(#s2g-skin)" />
            <path d="M346,8 Q360,16 356,36 Q368,30 364,16 Q356,6 346,8 Z" fill="#1c1026" />
            <path d="M324,26 Q318,40 324,54 Q312,46 314,30 Z" fill="#1c1026" />
            <path d="M332,6 Q346,0 356,10 L350,16 Q342,10 336,12 Z" fill="url(#s2g-gold)" />
            <circle cx="338" cy="26" r="3.6" fill="#37b6ff" />
            <circle cx="338" cy="26" r="1.4" fill="#04223a" />
            <path d="M322,60 Q346,54 370,60 L370,68 Q346,62 322,68 Z" fill="url(#s2g-gold)" opacity="0.95" />
            <!-- raised hand + pink flame -->
            <path d="M390,58 Q386,50 378,50 L374,58 L382,66 Z" fill="url(#s2g-skin)" />
            <ellipse cx="384" cy="40" rx="13" ry="17" fill="url(#s2g-pinkflame)">
              <animate attributeName="ry" values="17;21;17" dur="1.4s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="0.85;1;0.85" dur="1.4s" repeatCount="indefinite" />
            </ellipse>
            <path d="M384,28 Q388,36 384,44 Q380,36 384,28 Z" fill="#ffe0fb" opacity="0.9">
              <animate attributeName="opacity" values="0.6;1;0.6" dur="0.8s" repeatCount="indefinite" />
            </path>
          </g>
        </svg>

        <div class="absolute inset-x-0 top-1 flex flex-col items-center gap-1.5">
          <button
            class="s2-plaque rounded-full px-5 py-1.5 text-sm font-black tracking-wide transition active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40"
            :disabled="spinning"
            @click="buyOpen = true"
          >購買免費遊戲</button>
          <div class="inline-flex items-center gap-1.5 rounded-full bg-black/50 px-4 py-1 text-xs font-bold text-emerald-200 ring-1 ring-emerald-400/50 shadow-[0_0_14px_rgba(50,220,120,0.25)]">
            出現 <span class="inline-block h-4 w-4"><Seth2Symbol :type="10" /></span> 可乘上獎金
          </div>
        </div>
      </div>

      <!-- Board (gold frame + corner ornaments) -->
      <div class="relative mx-auto mt-1 max-w-md">
        <div class="s2-frame rounded-2xl p-[3px]" :class="awakenedNow ? 's2-frame-awaken' : ''">
          <div
            class="relative rounded-[13px] p-2"
            :class="[awakenedNow ? 'bg-[#1c060b]/95' : 'bg-[#060d1a]/95', boardShake ? 's2-shake' : '']"
          >
            <div class="s2-boardglow" :class="awakenedNow ? 's2-boardglow-awaken' : ''" aria-hidden="true" />
            <div class="relative grid grid-cols-6 gap-1.5">
              <div
                v-for="(c, i) in grid" :key="i"
                class="relative flex aspect-square items-center justify-center rounded-lg transition-all duration-200"
                :class="[
                  highlight.has(i) ? 's2-win bg-amber-400/25' : 'bg-white/[0.04] ring-1 ring-white/10',
                  c.type === ORB && !highlight.has(i) ? 'bg-emerald-500/15 ring-emerald-400/50' : '',
                  c.type === SCATTER && !highlight.has(i) ? 'ring-amber-400/60' : '',
                  orbFlash && c.type === ORB ? 's2-orb-pop' : '',
                ]"
              >
                <span :key="frameKey" class="s2-drop block h-[86%] w-[86%]" :style="dropStyle(i)">
                  <Seth2Symbol :type="c.type" :value="c.value" />
                </span>
                <span
                  v-if="c.type === ORB"
                  class="absolute bottom-0 right-0.5 rounded bg-black/50 px-0.5 text-[10px] font-black text-emerald-100 drop-shadow sm:text-xs"
                >×{{ c.value }}</span>
                <svg v-if="highlight.has(i)" class="s2-burst pointer-events-none absolute inset-[-18%]" viewBox="0 0 100 100" aria-hidden="true">
                  <g stroke="#ffd257" stroke-width="3" stroke-linecap="round">
                    <path d="M50,4 v12 M50,84 v12 M4,50 h12 M84,50 h12 M17,17 l8,8 M75,75 l8,8 M83,17 l-8,8 M25,75 l-8,8" />
                  </g>
                </svg>
              </div>
            </div>

            <!-- frame win banner -->
            <div
              v-if="winFlash > 0"
              class="pointer-events-none absolute left-1/2 top-1.5 z-10 -translate-x-1/2 rounded-full bg-gradient-to-r from-amber-300 via-yellow-200 to-amber-300 px-4 py-1 text-sm font-black text-[#1c0f06] shadow-[0_0_20px_rgba(255,200,80,0.7)]"
            >+{{ winFlash.toLocaleString() }}</div>

            <!-- multiplier show-piece -->
            <div v-if="multiplierFlash > 0" class="pointer-events-none absolute inset-0 z-10 grid place-items-center overflow-hidden rounded-[13px]">
              <div class="s2-rays" aria-hidden="true" />
              <span class="s2-mult s2-goldtext">×{{ multiplierFlash }}</span>
            </div>
          </div>
        </div>
        <span class="s2-corner s2-corner-tl" aria-hidden="true" /><span class="s2-corner s2-corner-tr" aria-hidden="true" />
        <span class="s2-corner s2-corner-bl" aria-hidden="true" /><span class="s2-corner s2-corner-br" aria-hidden="true" />
      </div>

      <!-- Message -->
      <p
        class="mt-2.5 min-h-[2.2rem] text-center text-sm font-bold"
        :class="lastWin > 0 ? 'text-amber-300' : 'text-white/70'"
      >{{ message }}</p>

      <!-- 下注 / 贏分 / 餘額 -->
      <div class="mx-auto grid max-w-md grid-cols-3 gap-2 rounded-xl bg-black/45 px-3 py-2 ring-1 ring-amber-500/20">
        <div class="flex items-center justify-center gap-2">
          <button class="grid h-7 w-7 place-items-center rounded-full bg-white/10 font-black text-amber-300 transition hover:bg-white/20 disabled:opacity-40" :disabled="spinning" @click="stepBet(-1)">−</button>
          <div class="text-center">
            <p class="text-[10px] text-white/50">下注</p>
            <p class="text-sm font-black text-yellow-300">{{ bet }}</p>
          </div>
          <button class="grid h-7 w-7 place-items-center rounded-full bg-white/10 font-black text-amber-300 transition hover:bg-white/20 disabled:opacity-40" :disabled="spinning" @click="stepBet(1)">＋</button>
        </div>
        <div class="text-center">
          <p class="text-[10px] text-white/50">贏分</p>
          <p class="text-sm font-black text-yellow-300">{{ lastWin.toLocaleString() }}</p>
        </div>
        <div class="text-center">
          <p class="text-[10px] text-white/50">餘額</p>
          <p class="text-sm font-black text-yellow-300">{{ coins.toLocaleString() }}</p>
        </div>
      </div>

      <!-- Controls -->
      <div class="mx-auto mt-3 flex max-w-md items-center justify-center gap-5">
        <button
          class="grid h-12 w-12 place-items-center rounded-full ring-2 transition"
          :class="turbo ? 'bg-amber-400 text-[#1c0f06] ring-amber-300 shadow-[0_0_16px_rgba(255,190,60,0.5)]' : 'bg-black/50 text-white/60 ring-white/15 hover:text-white'"
          title="快速模式"
          @click="turbo = !turbo"
        ><Zap class="h-5 w-5" /></button>

        <button class="s2-spinbtn relative grid h-[5.5rem] w-[5.5rem] place-items-center rounded-full transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-50" :disabled="!canSpin" @click="play('NONE')">
          <span class="s2-spinring absolute inset-0 rounded-full" :class="{ 's2-spinring-idle': canSpin && !spinning }" aria-hidden="true" />
          <span class="absolute inset-[5px] rounded-full bg-gradient-to-b from-fuchsia-500 via-purple-700 to-purple-950 ring-2 ring-amber-300/60" aria-hidden="true" />
          <RotateCw class="relative h-9 w-9 text-amber-300 drop-shadow-[0_0_6px_rgba(255,200,80,0.8)]" :class="{ 'animate-spin': spinning }" />
        </button>

        <button
          class="grid h-12 w-12 place-items-center rounded-full ring-2 transition"
          :class="auto ? 'bg-emerald-500 text-white ring-emerald-300 shadow-[0_0_16px_rgba(50,220,120,0.5)]' : 'bg-black/50 text-white/60 ring-white/15 hover:text-white'"
          :title="auto ? '自動旋轉：開' : '自動旋轉'"
          @click="toggleAuto()"
        ><span class="text-[10px] font-black leading-none">AUTO</span></button>
      </div>
      <p class="mt-1.5 text-center text-2xs text-white/40">
        {{ !auth.isAuthenticated ? '請先登入' : coins < spinCost ? '遊戲幣不足' : spinning ? '連消中…' : `每轉 -${spinCost.toLocaleString()}` }}
      </p>

      <!-- Paytable -->
      <div class="mt-4 grid grid-cols-5 gap-1.5 text-center sm:grid-cols-9">
        <div v-for="(name, i) in SYMBOL_NAMES" :key="i" class="flex flex-col items-center rounded-lg bg-white/5 py-1.5 ring-1 ring-white/5">
          <span class="block h-8 w-8"><Seth2Symbol :type="i" /></span>
          <span class="block text-[10px] text-amber-300/80">×{{ TOP_PAY[i] }}</span>
          <span class="block text-[9px] text-white/30">{{ name }}</span>
        </div>
      </div>
      <p class="mt-3 text-center text-2xs text-white/30">
        金聖甲蟲×3 觸發免費遊戲（×4 直接覺醒）· 綠聖甲蟲倍數於免費遊戲中持續累加 · 覺醒之力大幅提升倍數 · 虛擬幣練習用途，無真實金錢
      </p>
    </div>

    <!-- ===== 全屏演出 overlays ===== -->
    <Transition name="s2-fade">
      <div v-if="freeIntro" class="s2-overlay">
        <div class="s2-zoom text-center">
          <span class="mx-auto block h-24 w-24 drop-shadow-[0_0_30px_rgba(255,200,80,0.8)]"><Seth2Symbol :type="9" /></span>
          <p class="s2-goldtext mt-2 text-5xl font-black tracking-widest">免費遊戲</p>
          <p class="mt-2 text-2xl font-black text-amber-200">×{{ freeIntro }}</p>
        </div>
      </div>
    </Transition>
    <Transition name="s2-fade">
      <div v-if="awakenIntro" class="s2-overlay s2-overlay-red">
        <div class="s2-zoom text-center">
          <svg viewBox="0 0 100 100" class="mx-auto h-24 w-24 drop-shadow-[0_0_30px_rgba(255,80,80,0.9)]" aria-hidden="true">
            <path d="M58,4 L28,52 L46,52 L38,96 L76,40 L56,40 Z" fill="#ffd257" stroke="#8a3a06" stroke-width="2" />
          </svg>
          <p class="s2-redtext mt-2 text-5xl font-black tracking-widest">覺醒之力</p>
          <p class="mt-2 text-sm font-bold text-red-200/90">聖甲蟲倍數大幅提升</p>
        </div>
      </div>
    </Transition>
    <Transition name="s2-fade">
      <div v-if="bigWin" class="s2-overlay">
        <div class="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
          <span
            v-for="(c, i) in rain" :key="i" class="s2-coin"
            :style="{ left: c.left + '%', animationDelay: c.delay + 's', animationDuration: c.dur + 's', width: c.size + 'px', height: c.size + 'px' }"
          />
        </div>
        <div class="s2-zoom text-center">
          <p class="s2-goldtext text-6xl font-black italic tracking-wide">{{ bigWin.tier }}</p>
          <p class="mt-3 font-mono text-4xl font-black text-yellow-300 drop-shadow-[0_0_18px_rgba(255,220,100,0.8)]">{{ shownWin.toLocaleString() }}</p>
        </div>
      </div>
    </Transition>

    <!-- ===== 購買免費遊戲 modal ===== -->
    <Teleport to="body">
      <div v-if="buyOpen" class="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm" @click.self="buyOpen = false">
        <div class="w-full max-w-lg rounded-2xl bg-gradient-to-b from-[#3a0d12] via-[#240a10] to-[#12040a] p-4 ring-2 ring-amber-500/50 shadow-[0_0_60px_rgba(255,120,40,0.25)]">
          <div class="mb-3 flex items-center justify-between">
            <h4 class="inline-flex items-center gap-1.5 text-base font-black text-amber-300">
              3× <span class="text-xs">SCATTER</span> ＋ <span class="inline-block h-5 w-5"><Seth2Symbol :type="9" /></span> 覺醒之力
            </h4>
            <button class="grid h-8 w-8 place-items-center rounded-full bg-white/10 text-white/70 hover:bg-white/20" @click="buyOpen = false">
              <X class="h-4 w-4" />
            </button>
          </div>
          <div class="grid grid-cols-3 gap-2">
            <div
              v-for="t in BUY_TIERS" :key="t.key"
              class="flex flex-col items-center rounded-xl border p-2.5 text-center transition hover:-translate-y-0.5"
              :class="{
                'border-amber-400/50 bg-amber-400/5 hover:shadow-[0_0_18px_rgba(255,190,60,0.25)]': t.accent === 'amber',
                'border-fuchsia-400/50 bg-fuchsia-400/5 hover:shadow-[0_0_18px_rgba(230,80,255,0.25)]': t.accent === 'fuchsia',
                'border-red-400/50 bg-red-400/5 hover:shadow-[0_0_18px_rgba(255,80,80,0.25)]': t.accent === 'red',
              }"
            >
              <p class="text-sm font-black" :class="{ 'text-amber-300': t.accent === 'amber', 'text-fuchsia-300': t.accent === 'fuchsia', 'text-red-300': t.accent === 'red' }">{{ t.name }}</p>
              <span class="my-1.5 block h-11 w-11"><Seth2Symbol :type="t.key === 'FREE' ? 9 : 10" /></span>
              <p class="min-h-[2.2rem] whitespace-pre-line text-[10px] leading-tight text-white/60">{{ t.desc }}</p>
              <p class="mt-1 text-sm font-black text-yellow-300">{{ buyCost(t.mult).toLocaleString() }}</p>
              <button
                class="mt-1.5 w-full rounded-lg py-1 text-xs font-black text-white shadow transition active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40"
                :class="{ 'bg-amber-500 hover:bg-amber-400': t.accent === 'amber', 'bg-fuchsia-600 hover:bg-fuchsia-500': t.accent === 'fuchsia', 'bg-red-600 hover:bg-red-500': t.accent === 'red' }"
                :disabled="coins < buyCost(t.mult) || spinning"
                @click="play(t.key)"
              >{{ coins < buyCost(t.mult) ? '餘額不足' : '購買' }}</button>
            </div>
          </div>
          <p class="mt-3 text-center text-2xs text-white/40">下注 {{ bet }} · 購買價格＝下注 ×200／×500／×2000</p>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
/* ---------- stage ---------- */
.s2-stage {
  background:
    radial-gradient(120% 90% at 50% -10%, rgba(80, 40, 160, 0.35), transparent 60%),
    radial-gradient(100% 70% at 100% 100%, rgba(200, 90, 20, 0.18), transparent 55%),
    radial-gradient(100% 70% at 0% 100%, rgba(20, 90, 160, 0.18), transparent 55%),
    linear-gradient(180deg, #17263c 0%, #0d1626 45%, #070b14 100%);
}
.s2-stage-awaken {
  background:
    radial-gradient(120% 90% at 50% -10%, rgba(200, 30, 40, 0.4), transparent 60%),
    radial-gradient(100% 70% at 100% 100%, rgba(255, 90, 20, 0.2), transparent 55%),
    linear-gradient(180deg, #3c1017 0%, #240811 45%, #10030a 100%);
}
.s2-awaken-vignette {
  position: absolute;
  inset: 0;
  pointer-events: none;
  border-radius: inherit;
  box-shadow: inset 0 0 80px rgba(255, 40, 40, 0.35);
  animation: s2-vignette 1.8s ease-in-out infinite;
}
@keyframes s2-vignette {
  0%, 100% { opacity: 0.55; }
  50% { opacity: 1; }
}

/* ---------- floating dust ---------- */
.s2-dust { position: absolute; inset: 0; pointer-events: none; }
.s2-dust i {
  position: absolute;
  bottom: -6px;
  width: 4px;
  height: 4px;
  border-radius: 9999px;
  background: rgba(255, 210, 110, 0.7);
  box-shadow: 0 0 8px rgba(255, 200, 80, 0.8);
  animation: s2-float 9s linear infinite;
  opacity: 0;
}
.s2-dust i:nth-child(1) { left: 8%; animation-delay: 0s; }
.s2-dust i:nth-child(2) { left: 18%; animation-delay: 2.2s; animation-duration: 11s; }
.s2-dust i:nth-child(3) { left: 28%; animation-delay: 4.5s; }
.s2-dust i:nth-child(4) { left: 38%; animation-delay: 1.2s; animation-duration: 12s; }
.s2-dust i:nth-child(5) { left: 50%; animation-delay: 3.4s; }
.s2-dust i:nth-child(6) { left: 60%; animation-delay: 5.6s; animation-duration: 10s; }
.s2-dust i:nth-child(7) { left: 70%; animation-delay: 0.8s; }
.s2-dust i:nth-child(8) { left: 80%; animation-delay: 2.9s; animation-duration: 13s; }
.s2-dust i:nth-child(9) { left: 90%; animation-delay: 4.1s; }
.s2-dust i:nth-child(10) { left: 45%; animation-delay: 6.3s; animation-duration: 8s; }
@keyframes s2-float {
  0% { transform: translateY(0) scale(0.7); opacity: 0; }
  12% { opacity: 0.9; }
  85% { opacity: 0.5; }
  100% { transform: translateY(-480px) scale(1.1); opacity: 0; }
}

/* ---------- gold text / plaque ---------- */
.s2-goldtext {
  background: linear-gradient(180deg, #fff4bd 8%, #ffd257 38%, #b57a16 62%, #ffe89a 90%);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.7));
}
.s2-redtext {
  background: linear-gradient(180deg, #ffd9c0 8%, #ff7a45 40%, #c1121f 65%, #ffb35c 90%);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.8));
}
.s2-plaque {
  color: #2a1503;
  background: linear-gradient(180deg, #ffeaa0, #e8b845 55%, #a86f16);
  border: 1px solid #ffe9a0;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.55), 0 0 18px rgba(255, 190, 60, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.7);
}
.s2-plaque:hover:not(:disabled) { filter: brightness(1.08); }

/* ---------- board frame ---------- */
.s2-frame {
  background: linear-gradient(160deg, #f6d878, #8a5a12 30%, #f2cd5e 50%, #6e430a 72%, #ffe89a);
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.6), 0 0 26px rgba(255, 190, 60, 0.22);
}
.s2-frame-awaken {
  background: linear-gradient(160deg, #ff9a6a, #7a1220 30%, #ff7a45 50%, #58101c 72%, #ffb35c);
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.6), 0 0 30px rgba(255, 80, 60, 0.35);
}
.s2-boardglow {
  position: absolute;
  inset: 0;
  border-radius: 13px;
  pointer-events: none;
  background: radial-gradient(80% 55% at 50% 0%, rgba(120, 80, 220, 0.16), transparent 70%);
}
.s2-boardglow-awaken {
  background: radial-gradient(80% 55% at 50% 0%, rgba(255, 60, 60, 0.18), transparent 70%);
}
.s2-corner {
  position: absolute;
  width: 22px;
  height: 22px;
  border: 3px solid #f2cd5e;
  filter: drop-shadow(0 0 6px rgba(255, 200, 80, 0.6));
  pointer-events: none;
}
.s2-corner-tl { left: -5px; top: -5px; border-right: 0; border-bottom: 0; border-top-left-radius: 12px; }
.s2-corner-tr { right: -5px; top: -5px; border-left: 0; border-bottom: 0; border-top-right-radius: 12px; }
.s2-corner-bl { left: -5px; bottom: -5px; border-right: 0; border-top: 0; border-bottom-left-radius: 12px; }
.s2-corner-br { right: -5px; bottom: -5px; border-left: 0; border-top: 0; border-bottom-right-radius: 12px; }

/* ---------- cell effects ---------- */
.s2-drop {
  animation: s2-drop 0.34s cubic-bezier(0.34, 1.4, 0.64, 1) backwards;
}
@keyframes s2-drop {
  0% { transform: translateY(-90%) scale(0.9); opacity: 0; }
  70% { transform: translateY(6%) scale(1.02); opacity: 1; }
  100% { transform: translateY(0) scale(1); opacity: 1; }
}
.s2-win {
  animation: s2-winpulse 0.62s ease-in-out infinite;
  box-shadow: 0 0 0 2px rgba(255, 210, 87, 0.9), 0 0 18px rgba(255, 200, 80, 0.8);
}
@keyframes s2-winpulse {
  0%, 100% { transform: scale(1.06); filter: brightness(1.15); }
  50% { transform: scale(1.14); filter: brightness(1.5); }
}
.s2-burst {
  animation: s2-burst 0.6s ease-out infinite;
}
@keyframes s2-burst {
  0% { transform: scale(0.6); opacity: 0; }
  35% { opacity: 1; }
  100% { transform: scale(1.15); opacity: 0; }
}
.s2-orb-pop {
  animation: s2-orbpop 0.5s ease-in-out infinite;
}
@keyframes s2-orbpop {
  0%, 100% { transform: scale(1.05); }
  50% { transform: scale(1.18); filter: brightness(1.4); }
}
.s2-shake {
  animation: s2-shake 0.45s ease-in-out;
}
@keyframes s2-shake {
  0%, 100% { transform: translate(0, 0); }
  20% { transform: translate(-4px, 2px); }
  40% { transform: translate(4px, -2px); }
  60% { transform: translate(-3px, -2px); }
  80% { transform: translate(3px, 2px); }
}

/* ---------- multiplier rays ---------- */
.s2-rays {
  position: absolute;
  inset: -40%;
  background: conic-gradient(
    rgba(255, 210, 90, 0) 0deg, rgba(255, 210, 90, 0.35) 14deg, rgba(255, 210, 90, 0) 28deg,
    rgba(255, 210, 90, 0) 60deg, rgba(255, 210, 90, 0.3) 74deg, rgba(255, 210, 90, 0) 88deg,
    rgba(255, 210, 90, 0) 120deg, rgba(255, 210, 90, 0.35) 134deg, rgba(255, 210, 90, 0) 148deg,
    rgba(255, 210, 90, 0) 180deg, rgba(255, 210, 90, 0.3) 194deg, rgba(255, 210, 90, 0) 208deg,
    rgba(255, 210, 90, 0) 240deg, rgba(255, 210, 90, 0.35) 254deg, rgba(255, 210, 90, 0) 268deg,
    rgba(255, 210, 90, 0) 300deg, rgba(255, 210, 90, 0.3) 314deg, rgba(255, 210, 90, 0) 328deg, rgba(255, 210, 90, 0) 360deg
  );
  animation: s2-spin 5s linear infinite;
}
.s2-mult {
  position: relative;
  font-size: 4rem;
  font-weight: 900;
  animation: s2-multin 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) backwards;
}
@keyframes s2-multin {
  0% { transform: scale(0.2); opacity: 0; }
  100% { transform: scale(1); opacity: 1; }
}
@keyframes s2-spin {
  to { transform: rotate(360deg); }
}

/* ---------- spin button ---------- */
.s2-spinring {
  background: conic-gradient(#ffd257, #b45cff, #37e2c2, #ffd257);
  animation: s2-spin 3.2s linear infinite;
  filter: blur(0.5px);
}
.s2-spinring-idle {
  box-shadow: 0 0 22px rgba(255, 190, 60, 0.55);
}

/* ---------- full-screen overlays ---------- */
.s2-overlay {
  position: absolute;
  inset: 0;
  z-index: 30;
  display: grid;
  place-items: center;
  border-radius: inherit;
  background: radial-gradient(80% 60% at 50% 45%, rgba(60, 35, 5, 0.75), rgba(0, 0, 0, 0.85));
  backdrop-filter: blur(2px);
}
.s2-overlay-red {
  background: radial-gradient(80% 60% at 50% 45%, rgba(90, 8, 12, 0.8), rgba(0, 0, 0, 0.88));
}
.s2-zoom { animation: s2-zoomin 0.55s cubic-bezier(0.34, 1.56, 0.64, 1) backwards; }
@keyframes s2-zoomin {
  0% { transform: scale(0.4); opacity: 0; }
  100% { transform: scale(1); opacity: 1; }
}
.s2-fade-enter-active, .s2-fade-leave-active { transition: opacity 0.3s ease; }
.s2-fade-enter-from, .s2-fade-leave-to { opacity: 0; }

/* ---------- coin rain ---------- */
.s2-coin {
  position: absolute;
  top: -30px;
  border-radius: 9999px;
  background: radial-gradient(circle at 35% 30%, #fff4bd, #f2cd5e 45%, #a86f16 85%);
  border: 1.5px solid #ffe9a0;
  box-shadow: 0 0 10px rgba(255, 210, 90, 0.8);
  animation: s2-coinfall linear infinite;
}
@keyframes s2-coinfall {
  0% { transform: translateY(0) rotate(0deg) scaleX(1); opacity: 1; }
  50% { transform: translateY(260px) rotate(180deg) scaleX(0.35); }
  100% { transform: translateY(540px) rotate(360deg) scaleX(1); opacity: 0.6; }
}
</style>
