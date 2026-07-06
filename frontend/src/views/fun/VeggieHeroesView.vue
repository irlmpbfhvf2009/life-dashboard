<script setup lang="ts">
// 菜菜勇者團：無盡農場 — 1~4 人手機合作 Roguelike 生存（全頁遊戲）
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  gs, api, ensureSocket, createRoom, joinRoom, leaveRoom, bindEngine, unbindEngine, pushToast,
} from '@/game/net'
import { engine } from '@/game/render'
import { useGameSound, playMusic, stopMusic, sfx } from '@/game/sound'
import Portrait from '@/game/Portrait.vue'
import { CHARACTERS, CHARACTER_MAP } from '@game/content/characters'
import { WEAPON_MAP } from '@game/content/weapons'
import { UPGRADE_MAP } from '@game/content/upgrades'
import { ITEM_MAP } from '@game/content/pickups'
import { ROUTES } from '@game/content/routes'
import { TEAM_SHOP_ITEMS } from '@game/content/teamShop'
import { EVENT_MAP } from '@game/content/events'
import { ZONE_MAP } from '@game/content/zones'
import type { Mode } from '@game/types'

const route = useRoute()
const router = useRouter()
const { muted, musicOn, toggleMute, toggleMusic } = useGameSound()

// ---------------------------------------------------------------- 畫面狀態
const screen = computed(() => {
  if (!gs.room) return 'home'
  if (gs.room.phase === 'lobby') return 'lobby'
  if (gs.room.phase === 'select') return 'select'
  return 'game'
})
const me = computed(() => gs.room?.players.find(p => p.id === gs.playerId))
const isHost = computed(() => gs.room?.hostId === gs.playerId)

// ---------------------------------------------------------------- 首頁
const playerName = ref(localStorage.getItem('veggie-name') ?? '')
const joinCode = ref('')
const busy = ref(false)
const homeError = ref('')
const cfg = ref<{ mode: Mode; difficulty: number; maxPlayers: number }>({ mode: 'standard', difficulty: 0, maxPlayers: 4 })
const MODES: { id: Mode; name: string; desc: string }[] = [
  { id: 'quick', name: '快速', desc: '10 波 · 約 10 分鐘' },
  { id: 'standard', name: '標準', desc: '20 波 · 雙 Boss' },
  { id: 'endless', name: '無盡', desc: '20 波後無盡加壓' },
]
const DIFFS = ['普通', '困難', '夢魘']

async function doCreate() {
  if (!playerName.value.trim()) { homeError.value = '先取個名字吧'; return }
  localStorage.setItem('veggie-name', playerName.value.trim())
  busy.value = true
  const err = await createRoom(playerName.value.trim(), { ...cfg.value })
  busy.value = false
  homeError.value = err ?? ''
  if (!err) { sfx.click(); playMusic('lobby') }
}
async function doJoin(code?: string) {
  const c = (code ?? joinCode.value).trim().toUpperCase()
  if (!playerName.value.trim()) { homeError.value = '先取個名字吧'; return }
  if (c.length < 4) { homeError.value = '請輸入 4 位房號'; return }
  localStorage.setItem('veggie-name', playerName.value.trim())
  busy.value = true
  const err = await joinRoom(c, playerName.value.trim())
  busy.value = false
  homeError.value = err ?? ''
  if (!err) { sfx.click(); playMusic('lobby') }
}

// ---------------------------------------------------------------- 大廳
const qrUrl = ref('')
const inviteLink = computed(() => gs.room ? `${location.origin}/veggie?room=${gs.room.code}` : '')
watch(() => gs.room?.code, async (code) => {
  qrUrl.value = ''
  if (!code) return
  try {
    const QR = await import('qrcode')
    qrUrl.value = await QR.toDataURL(inviteLink.value, { width: 220, margin: 1, color: { dark: '#1a1208', light: '#fff8e8' } })
  } catch { /* QR 失敗仍可用房號/連結 */ }
}, { immediate: true })

const copied = ref(false)
async function copyLink() {
  try {
    await navigator.clipboard.writeText(inviteLink.value)
    copied.value = true
    setTimeout(() => { copied.value = false }, 1500)
  } catch { pushToast('複製失敗，請手動複製', 'warn') }
}

// ---------------------------------------------------------------- 選角
const pickedChar = ref('')
const pickedWeapon = ref('')
function pickChar(id: string) {
  sfx.click()
  pickedChar.value = id
  pickedWeapon.value = ''
  api.pick({ charId: id })
}
function pickWeapon(id: string) {
  sfx.click()
  pickedWeapon.value = id
  api.pick({ weaponId: id })
}
const WEAPON_EMOJI: Record<string, string> = {
  pea_gun: '🌱', knife: '🔪', spin_axe: '🪓', hammer: '🔨', fireball: '🔥', ice_shard: '❄️',
  lightning: '⚡', mine: '💣', turret_gun: '🗼', heal_orb: '💚', poison_flask: '🧪', drone: '🛸',
}
const ROLE_NAME: Record<string, string> = { tank: '坦克', dps: '輸出', support: '輔助', engineer: '工程', control: '控場', gambler: '賭運' }

// ---------------------------------------------------------------- 戰鬥
const gameCanvas = ref<HTMLCanvasElement | null>(null)
const joy = ref({ active: false, ox: 0, oy: 0, dx: 0, dy: 0 })

function onPointerDown(e: PointerEvent) {
  if (gs.inter || gs.over) return
  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  joy.value = { active: true, ox: e.clientX, oy: e.clientY, dx: 0, dy: 0 }
}
function onPointerMove(e: PointerEvent) {
  if (!joy.value.active) return
  const maxR = 56
  let dx = e.clientX - joy.value.ox
  let dy = e.clientY - joy.value.oy
  const dd = Math.hypot(dx, dy)
  if (dd > maxR) { dx = dx / dd * maxR; dy = dy / dd * maxR }
  joy.value.dx = dx
  joy.value.dy = dy
  const dead = 8
  if (dd > dead) {
    engine.moveDir = { x: dx / maxR, y: dy / maxR, active: true }
  } else {
    engine.moveDir.active = false
  }
}
function onPointerUp() {
  joy.value.active = false
  engine.moveDir.active = false
}
function useSkill() {
  if (gs.hud.skillCd > 0) return
  const dir = engine.moveDir.active ? engine.moveDir : { x: 0, y: -1 }
  api.skill(engine.myX + dir.x * 300, engine.myY + dir.y * 300)
}
const myChar = computed(() => CHARACTER_MAP.get(gs.begin?.players.find(p => p.id === gs.playerId)?.charId ?? ''))
const skillCdPct = computed(() => {
  const max = myChar.value?.active.cooldown ?? 10
  return Math.min(1, gs.hud.skillCd / max)
})
const eventName = computed(() => gs.waveInfo?.event ? EVENT_MAP.get(gs.waveInfo.event)?.name : '')
const zoneName = computed(() => ZONE_MAP.get(gs.waveInfo?.zone ?? '')?.name ?? '')

// ---------------------------------------------------------------- 中場 helpers
const RARITY_STYLE: Record<string, string> = {
  common: 'border-slate-400/60 bg-slate-500/10 text-slate-100',
  rare: 'border-sky-400/70 bg-sky-500/15 text-sky-100',
  epic: 'border-violet-400/70 bg-violet-500/15 text-violet-100',
  legendary: 'border-amber-400/80 bg-amber-500/15 text-amber-100',
  cursed: 'border-rose-500/80 bg-rose-600/15 text-rose-100',
}
const RARITY_NAME: Record<string, string> = { common: '普通', rare: '稀有', epic: '史詩', legendary: '傳說', cursed: '詛咒' }
const upg = (id: string) => UPGRADE_MAP.get(id)
const wpn = (id: string) => WEAPON_MAP.get(id)
const itemOf = (id: string) => ITEM_MAP.get(id)
const routeOf = (id: string) => ROUTES.find(r => r.id === id)
const teamItemOf = (id: string) => TEAM_SHOP_ITEMS.find(t => t.id === id)
const playerName2 = (id: string) => gs.begin?.players.find(p => p.id === id)?.name ?? '?'

function offerName(o: { kind: string; refId: string; weaponLevel?: number }): string {
  if (o.kind === 'weapon') return `${WEAPON_EMOJI[o.refId] ?? '⚔️'} ${wpn(o.refId)?.name}${(o.weaponLevel ?? 1) > 1 ? ` Lv.${o.weaponLevel}` : ''}`
  if (o.kind === 'item') return `${itemOf(o.refId)?.emoji ?? '✨'} ${itemOf(o.refId)?.name}`
  return upg(o.refId)?.name ?? o.refId
}
function offerDesc(o: { kind: string; refId: string }): string {
  if (o.kind === 'weapon') return wpn(o.refId)?.description ?? ''
  if (o.kind === 'item') return itemOf(o.refId)?.description ?? ''
  return upg(o.refId)?.description ?? ''
}
function offerRarity(o: { kind: string; refId: string }): string {
  if (o.kind === 'upgrade') return upg(o.refId)?.rarity ?? 'common'
  if (o.kind === 'weapon') return (wpn(o.refId)?.tier ?? 1) >= 2 ? 'rare' : 'common'
  return 'common'
}
const interReady = computed(() => !!gs.inter?.readySet.includes(gs.playerId))
function sellWeapon(i: number, id: string, level: number) {
  if ((gs.inter?.me.weapons.length ?? 0) <= 1) { pushToast('至少要保留一把武器', 'warn'); return }
  if (window.confirm(`賣出 ${wpn(id)?.name} Lv.${level}？（拿回 60% 金幣）`)) api.sell(i)
}
const connectedCount = computed(() => gs.room?.players.filter(p => p.connected).length ?? 1)

// ---------------------------------------------------------------- Debug
const showDebugBtn = computed(() => import.meta.env.DEV || route.query.debug === '1')

// ---------------------------------------------------------------- 生命週期
onMounted(() => {
  ensureSocket()
  const q = String(route.query.room ?? '')
  if (q) joinCode.value = q.toUpperCase()
})

watch(screen, async (s) => {
  if (s === 'game') {
    await nextTick()
    if (gameCanvas.value) {
      bindEngine({
        snap: (snap) => engine.applySnapshot(snap),
        evs: (evs) => engine.applyEvents(evs),
        wave: (w) => {
          engine.arena = gs.begin?.arena ?? engine.arena
          engine.onWave(w)
        },
      })
      engine.start(gameCanvas.value)
      if (gs.begin) engine.arena = gs.begin.arena
      if (gs.waveInfo) engine.onWave(gs.waveInfo)
    }
  } else {
    engine.stop()
    unbindEngine()
    if (s === 'lobby' || s === 'select') playMusic('lobby')
    if (s === 'home') stopMusic()
  }
}, { immediate: true })

watch(() => gs.over, (o) => {
  if (!o) return
  if (o.victory) sfx.victory(); else sfx.defeat()
  // 紀錄最高波數
  const key = `veggie-best-${o.mode}`
  const prev = Number(localStorage.getItem(key) ?? 0)
  if (o.wave > prev) localStorage.setItem(key, String(o.wave))
})

onBeforeUnmount(() => {
  engine.stop()
  unbindEngine()
  stopMusic()
})

function exitGame() {
  leaveRoom()
  stopMusic()
}
function backToStudio() {
  router.push('/fun/games')
}

const bestWaves = computed(() => ({
  quick: localStorage.getItem('veggie-best-quick') ?? '—',
  standard: localStorage.getItem('veggie-best-standard') ?? '—',
  endless: localStorage.getItem('veggie-best-endless') ?? '—',
}))

const fmtTime = (s: number) => {
  if (s > 900) return 'BOSS'
  const m = Math.floor(s / 60)
  return `${m}:${String(Math.floor(s % 60)).padStart(2, '0')}`
}
</script>

<template>
  <div class="fixed inset-0 z-50 flex flex-col overflow-hidden bg-[#0d1a0d] font-sans text-white" style="touch-action: none;">

    <!-- ============================================================ 首頁 -->
    <div v-if="screen === 'home'" class="flex flex-1 flex-col items-center overflow-y-auto px-5 py-8" style="touch-action: pan-y;">
      <button class="absolute left-3 top-3 rounded-lg bg-white/10 px-3 py-1.5 text-xs text-white/70" @click="backToStudio">← 回工作台</button>
      <div class="mt-6 flex items-end gap-1">
        <Portrait kind="char" id="warrior_sweetpotato" :size="52" />
        <Portrait kind="char" id="medic_radish" :size="44" />
        <Portrait kind="char" id="gunner_potato" :size="48" />
      </div>
      <h1 class="mt-2 text-center text-3xl font-black tracking-wide text-lime-300 drop-shadow-[0_0_18px_rgba(163,230,53,0.5)]">菜菜勇者團</h1>
      <p class="text-sm font-bold text-amber-200/90">無盡農場 · 1~4 人合作生存</p>

      <div class="mt-6 w-full max-w-sm space-y-4">
        <input
          v-model="playerName" maxlength="12" placeholder="你的勇者名"
          class="w-full rounded-xl border border-white/15 bg-white/10 px-4 py-3 text-center text-lg font-bold outline-none placeholder:text-white/30 focus:border-lime-400"
        >
        <!-- 建房 -->
        <div class="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p class="mb-2 text-xs font-bold text-white/50">建立房間</p>
          <div class="mb-2 grid grid-cols-3 gap-2">
            <button
              v-for="m in MODES" :key="m.id"
              class="rounded-lg border px-1 py-2 text-center transition"
              :class="cfg.mode === m.id ? 'border-lime-400 bg-lime-400/15 text-lime-200' : 'border-white/10 bg-white/5 text-white/60'"
              @click="cfg.mode = m.id"
            >
              <span class="block text-sm font-bold">{{ m.name }}</span>
              <span class="block text-[10px] opacity-70">{{ m.desc }}</span>
            </button>
          </div>
          <div class="mb-3 flex items-center justify-between gap-2 text-sm">
            <div class="flex items-center gap-1">
              <span class="text-xs text-white/50">難度</span>
              <button
                v-for="(d, i) in DIFFS" :key="d"
                class="rounded px-2 py-1 text-xs font-bold"
                :class="cfg.difficulty === i ? 'bg-rose-500/30 text-rose-200' : 'bg-white/5 text-white/40'"
                @click="cfg.difficulty = i"
              >{{ d }}</button>
            </div>
            <div class="flex items-center gap-1">
              <span class="text-xs text-white/50">人數</span>
              <button
                v-for="n in 4" :key="n"
                class="h-7 w-7 rounded text-xs font-bold"
                :class="cfg.maxPlayers === n ? 'bg-sky-500/30 text-sky-200' : 'bg-white/5 text-white/40'"
                @click="cfg.maxPlayers = n"
              >{{ n }}</button>
            </div>
          </div>
          <button
            class="w-full rounded-xl bg-gradient-to-r from-lime-500 to-emerald-600 py-3 text-lg font-black text-white shadow-lg shadow-lime-900/40 active:scale-95 disabled:opacity-50"
            :disabled="busy" @click="doCreate"
          >🏡 建立房間</button>
        </div>
        <!-- 加入 -->
        <div class="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p class="mb-2 text-xs font-bold text-white/50">加入朋友的房間</p>
          <div class="flex gap-2">
            <input
              v-model="joinCode" maxlength="4" placeholder="房號"
              class="w-28 rounded-xl border border-white/15 bg-white/10 px-3 py-2.5 text-center text-lg font-black uppercase tracking-widest outline-none focus:border-sky-400"
              @keyup.enter="doJoin()"
            >
            <button
              class="flex-1 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 py-2.5 font-black active:scale-95 disabled:opacity-50"
              :disabled="busy" @click="doJoin()"
            >🚪 加入房間</button>
          </div>
        </div>
        <p v-if="homeError" class="text-center text-sm font-bold text-rose-400">{{ homeError }}</p>
        <p v-if="!gs.connected && gs.connecting" class="text-center text-xs text-white/40">連線中…</p>
        <p v-else-if="gs.error" class="text-center text-xs text-rose-300/70">{{ gs.error }}（伺服器沒開？）</p>
        <div class="rounded-xl bg-white/5 px-4 py-3 text-center text-xs text-white/40">
          最高紀錄　快速 <b class="text-amber-300">{{ bestWaves.quick }}</b> 波 ·
          標準 <b class="text-amber-300">{{ bestWaves.standard }}</b> 波 ·
          無盡 <b class="text-amber-300">{{ bestWaves.endless }}</b> 波
        </div>
      </div>
    </div>

    <!-- ============================================================ 大廳 -->
    <div v-else-if="screen === 'lobby'" class="flex flex-1 flex-col items-center overflow-y-auto px-5 py-6" style="touch-action: pan-y;">
      <button class="absolute left-3 top-3 rounded-lg bg-white/10 px-3 py-1.5 text-xs text-white/70" @click="exitGame">← 離開</button>
      <p class="text-xs font-bold text-white/40">房號</p>
      <p class="text-5xl font-black tracking-[0.3em] text-amber-300">{{ gs.room!.code }}</p>
      <div class="mt-3 flex items-center gap-3">
        <img v-if="qrUrl" :src="qrUrl" alt="QR" class="h-28 w-28 rounded-xl border-4 border-white/80">
        <div class="max-w-[180px] space-y-2">
          <p class="text-xs leading-relaxed text-white/50">朋友掃 QR 或開連結，輸入房號即可加入</p>
          <button class="w-full rounded-lg bg-white/10 px-3 py-2 text-xs font-bold text-sky-300 active:scale-95" @click="copyLink">
            {{ copied ? '✅ 已複製' : '🔗 複製邀請連結' }}
          </button>
        </div>
      </div>

      <!-- 房間設定 -->
      <div class="mt-4 flex flex-wrap items-center justify-center gap-2 text-xs">
        <template v-if="isHost">
          <button
            v-for="m in MODES" :key="m.id"
            class="rounded-full border px-3 py-1 font-bold"
            :class="gs.room!.config.mode === m.id ? 'border-lime-400 bg-lime-400/20 text-lime-200' : 'border-white/10 text-white/40'"
            @click="api.setConfig({ mode: m.id })"
          >{{ m.name }}</button>
          <span class="text-white/20">|</span>
          <button
            v-for="(d, i) in DIFFS" :key="d"
            class="rounded-full border px-3 py-1 font-bold"
            :class="gs.room!.config.difficulty === i ? 'border-rose-400 bg-rose-400/20 text-rose-200' : 'border-white/10 text-white/40'"
            @click="api.setConfig({ difficulty: i })"
          >{{ d }}</button>
        </template>
        <template v-else>
          <span class="rounded-full bg-lime-400/20 px-3 py-1 font-bold text-lime-200">{{ MODES.find(m => m.id === gs.room!.config.mode)?.name }}模式</span>
          <span class="rounded-full bg-rose-400/20 px-3 py-1 font-bold text-rose-200">{{ DIFFS[gs.room!.config.difficulty] }}</span>
          <span class="rounded-full bg-sky-400/20 px-3 py-1 font-bold text-sky-200">最多 {{ gs.room!.config.maxPlayers }} 人</span>
        </template>
      </div>

      <!-- 玩家列表 -->
      <div class="mt-5 w-full max-w-sm space-y-2">
        <div
          v-for="p in gs.room!.players" :key="p.id"
          class="flex items-center justify-between rounded-xl border px-4 py-3"
          :class="p.connected ? 'border-white/10 bg-white/5' : 'border-white/5 bg-white/[0.02] opacity-50'"
        >
          <div class="flex items-center gap-2">
            <span class="text-lg">{{ p.isHost ? '👑' : '🥬' }}</span>
            <span class="font-bold" :class="p.id === gs.playerId ? 'text-amber-300' : ''">{{ p.name }}</span>
            <span v-if="!p.connected" class="text-[10px] text-rose-300">斷線</span>
          </div>
          <span
            class="rounded-full px-2.5 py-0.5 text-xs font-bold"
            :class="p.ready || p.isHost ? 'bg-lime-400/20 text-lime-300' : 'bg-white/10 text-white/40'"
          >{{ p.isHost ? '房主' : p.ready ? '已準備' : '未準備' }}</span>
        </div>
        <p class="text-center text-xs text-white/30">{{ gs.room!.players.filter(p => p.connected).length }} / {{ gs.room!.config.maxPlayers }} 人</p>
      </div>

      <div class="mt-5 w-full max-w-sm space-y-2 pb-6">
        <button
          v-if="!isHost"
          class="w-full rounded-xl py-3.5 text-lg font-black active:scale-95"
          :class="me?.ready ? 'bg-white/10 text-white/60' : 'bg-gradient-to-r from-lime-500 to-emerald-600'"
          @click="api.ready(!me?.ready)"
        >{{ me?.ready ? '取消準備' : '✋ 準備！' }}</button>
        <button
          v-else
          class="w-full rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 py-3.5 text-lg font-black shadow-lg active:scale-95"
          @click="api.start()"
        >🚀 開始遊戲</button>
      </div>
    </div>

    <!-- ============================================================ 選角 -->
    <div v-else-if="screen === 'select'" class="flex flex-1 flex-col overflow-y-auto px-4 py-5" style="touch-action: pan-y;">
      <h2 class="text-center text-xl font-black text-lime-300">選擇你的勇者</h2>
      <div class="mx-auto mt-3 grid w-full max-w-md grid-cols-2 gap-2.5 sm:grid-cols-3">
        <button
          v-for="c in CHARACTERS" :key="c.id"
          class="flex flex-col items-center rounded-xl border p-2.5 text-center transition active:scale-95"
          :class="pickedChar === c.id ? 'border-lime-400 bg-lime-400/15 shadow-[0_0_16px_rgba(163,230,53,0.25)]' : 'border-white/10 bg-white/5'"
          @click="pickChar(c.id)"
        >
          <Portrait kind="char" :id="c.id" :size="60" />
          <span class="mt-1 text-sm font-black">{{ c.name }}</span>
          <span class="rounded bg-white/10 px-1.5 text-[10px] text-white/60">{{ ROLE_NAME[c.role] }}</span>
          <span class="mt-1 text-[10px] leading-tight text-white/45">{{ c.description }}</span>
        </button>
      </div>

      <template v-if="pickedChar">
        <h3 class="mt-5 text-center text-sm font-black text-amber-300">
          技能：{{ CHARACTER_MAP.get(pickedChar)?.active.name }} — {{ CHARACTER_MAP.get(pickedChar)?.active.description }}
        </h3>
        <p class="mt-3 text-center text-xs font-bold text-white/50">選擇初始武器</p>
        <div class="mx-auto mt-2 grid w-full max-w-md grid-cols-3 gap-2">
          <button
            v-for="wid in CHARACTER_MAP.get(pickedChar)?.startWeapons ?? []" :key="wid"
            class="rounded-xl border p-2.5 text-center active:scale-95"
            :class="pickedWeapon === wid ? 'border-amber-400 bg-amber-400/15' : 'border-white/10 bg-white/5'"
            @click="pickWeapon(wid)"
          >
            <span class="text-2xl">{{ WEAPON_EMOJI[wid] }}</span>
            <span class="block text-xs font-bold">{{ wpn(wid)?.name }}</span>
            <span class="block text-[10px] leading-tight text-white/40">{{ wpn(wid)?.description }}</span>
          </button>
        </div>
      </template>

      <!-- 隊友選角狀態 -->
      <div class="mx-auto mt-5 flex w-full max-w-md flex-wrap justify-center gap-2 text-xs">
        <span
          v-for="p in gs.room!.players.filter(p => p.connected)" :key="p.id"
          class="rounded-full px-3 py-1 font-bold"
          :class="p.ready ? 'bg-lime-400/20 text-lime-300' : 'bg-white/10 text-white/50'"
        >
          {{ p.name }}{{ p.ready ? ' ✓' : p.charId ? ' 選武器中…' : ' 選角中…' }}
        </span>
      </div>

      <button
        class="mx-auto mt-5 w-full max-w-md rounded-xl py-3.5 text-lg font-black active:scale-95 disabled:opacity-40"
        :class="me?.ready ? 'bg-white/10 text-white/50' : 'bg-gradient-to-r from-lime-500 to-emerald-600'"
        :disabled="!pickedChar || !pickedWeapon || me?.ready"
        @click="api.confirm(); sfx.click()"
      >{{ me?.ready ? '等待隊友…' : '⚔️ 出發！' }}</button>
      <div class="h-8" />
    </div>

    <!-- ============================================================ 戰鬥 -->
    <div v-else class="relative flex-1">
      <div
        class="absolute inset-0"
        @pointerdown="onPointerDown" @pointermove="onPointerMove" @pointerup="onPointerUp" @pointercancel="onPointerUp"
      >
        <canvas ref="gameCanvas" class="h-full w-full" />
      </div>

      <!-- 頂部 HUD -->
      <div class="pointer-events-none absolute inset-x-0 top-0 p-2">
        <div class="flex items-start justify-between gap-2">
          <!-- 波數/時間/區域 -->
          <div class="rounded-xl bg-black/45 px-3 py-1.5 backdrop-blur-sm">
            <p class="text-sm font-black text-amber-300">第 {{ gs.hud.wave }} 波 <span class="ml-1 text-white">{{ fmtTime(gs.hud.left) }}</span></p>
            <p class="text-[10px] text-white/50">{{ zoneName }}<span v-if="eventName" class="ml-1 text-rose-300">⚡{{ eventName }}</span></p>
          </div>
          <!-- 任務 -->
          <div v-if="gs.hud.mission" class="rounded-xl bg-black/45 px-3 py-1.5 text-center backdrop-blur-sm">
            <p class="text-[10px] font-bold" :class="gs.hud.mission.failed ? 'text-rose-400' : gs.hud.mission.done ? 'text-lime-400' : 'text-sky-300'">
              {{ gs.hud.mission.name }} {{ gs.hud.mission.done ? '✓' : gs.hud.mission.failed ? '✗' : '' }}
            </p>
            <p v-if="!gs.hud.mission.done && !gs.hud.mission.failed && gs.hud.mission.target > 1" class="text-[10px] text-white/60">
              {{ Math.min(gs.hud.mission.progress, gs.hud.mission.target) }} / {{ gs.hud.mission.target }}
            </p>
          </div>
          <!-- 金幣/等級/復活 -->
          <div class="rounded-xl bg-black/45 px-3 py-1.5 text-right backdrop-blur-sm">
            <p class="text-sm font-black text-amber-300">💰{{ gs.hud.gold }}</p>
            <p class="text-[10px] text-white/60">Lv.{{ gs.hud.lv }} · ⛑️×{{ gs.hud.teamRevives }}</p>
          </div>
        </div>
        <!-- Boss 血條 -->
        <div v-if="gs.hud.boss" class="mx-auto mt-1.5 max-w-md rounded-xl bg-black/50 px-3 py-1.5 backdrop-blur-sm">
          <p class="text-center text-xs font-black text-rose-300">👹 {{ gs.hud.boss.name }}</p>
          <div class="mt-0.5 h-2.5 overflow-hidden rounded-full bg-white/10">
            <div class="h-full rounded-full bg-gradient-to-r from-rose-600 to-rose-400 transition-all" :style="{ width: (gs.hud.boss.hp / gs.hud.boss.mhp * 100) + '%' }" />
          </div>
          <div v-if="gs.hud.boss.sh" class="mt-0.5 h-1 overflow-hidden rounded-full bg-white/10">
            <div class="h-full bg-sky-400" :style="{ width: Math.min(100, gs.hud.boss.sh / gs.hud.boss.mhp * 400) + '%' }" />
          </div>
        </div>
        <!-- 自己 + 隊友血條 -->
        <div class="mt-1.5 w-40 space-y-1">
          <div class="rounded-lg bg-black/45 px-2 py-1 backdrop-blur-sm">
            <div class="flex justify-between text-[10px] font-bold">
              <span class="text-amber-300">我 {{ gs.hud.status === 'downed' ? '🆘' : '' }}</span>
              <span class="text-white/70">{{ gs.hud.hp }}/{{ gs.hud.maxHp }}</span>
            </div>
            <div class="h-1.5 overflow-hidden rounded-full bg-white/10">
              <div class="h-full rounded-full transition-all" :class="gs.hud.hp / Math.max(1, gs.hud.maxHp) > 0.5 ? 'bg-lime-400' : gs.hud.hp / Math.max(1, gs.hud.maxHp) > 0.25 ? 'bg-amber-400' : 'bg-rose-500'" :style="{ width: (gs.hud.hp / Math.max(1, gs.hud.maxHp) * 100) + '%' }" />
            </div>
            <div class="mt-0.5 h-1 overflow-hidden rounded-full bg-white/10">
              <div class="h-full bg-sky-300" :style="{ width: (gs.hud.xp / Math.max(1, gs.hud.nxp) * 100) + '%' }" />
            </div>
          </div>
          <div v-for="m in gs.hud.mates" :key="m.id" class="rounded-lg bg-black/40 px-2 py-1 backdrop-blur-sm">
            <div class="flex justify-between text-[10px]">
              <span :class="m.st === 'downed' ? 'text-rose-400 font-bold' : m.st === 'disconnected' ? 'text-white/30' : 'text-white/70'">
                {{ m.name }} {{ m.st === 'downed' ? '🆘' : m.st === 'disconnected' ? '📴' : m.st === 'dead' ? '💀' : '' }}
              </span>
            </div>
            <div class="h-1 overflow-hidden rounded-full bg-white/10">
              <div class="h-full rounded-full" :class="m.st === 'downed' ? 'bg-rose-500' : 'bg-emerald-400'" :style="{ width: (m.st === 'downed' ? m.rp * 100 : m.hp / Math.max(1, m.mhp) * 100) + '%' }" />
            </div>
          </div>
        </div>
      </div>

      <!-- 倒地提示 -->
      <div v-if="gs.hud.status === 'downed'" class="pointer-events-none absolute inset-x-0 top-1/3 text-center">
        <p class="text-2xl font-black text-rose-400 drop-shadow-lg">你倒下了！</p>
        <p class="text-sm text-white/70">等待隊友救援…（可緩慢爬行）</p>
        <div class="mx-auto mt-2 h-2 w-40 overflow-hidden rounded-full bg-black/50">
          <div class="h-full bg-lime-400 transition-all" :style="{ width: (gs.hud.reviveProgress * 100) + '%' }" />
        </div>
      </div>

      <!-- 升級提示徽章 -->
      <div v-if="gs.hud.pendingLevelups > 0 && !gs.inter" class="pointer-events-none absolute right-3 top-24 rounded-full bg-violet-500/80 px-3 py-1 text-xs font-black shadow-lg">
        ⬆️ 升級 ×{{ gs.hud.pendingLevelups }}（波末選擇）
      </div>

      <!-- 技能按鈕 + 音效切換 -->
      <div class="absolute bottom-5 right-4 flex flex-col items-center gap-3">
        <div class="flex gap-1.5">
          <button class="grid h-8 w-8 place-items-center rounded-full bg-black/40 text-sm" @click="toggleMusic">{{ musicOn ? '🎵' : '🔇' }}</button>
          <button class="grid h-8 w-8 place-items-center rounded-full bg-black/40 text-sm" @click="toggleMute">{{ muted ? '🔕' : '🔔' }}</button>
        </div>
        <button
          class="relative grid h-20 w-20 place-items-center rounded-full border-4 text-3xl shadow-xl active:scale-90"
          :class="skillCdPct > 0 ? 'border-white/20 bg-black/50 grayscale' : 'border-amber-300 bg-gradient-to-br from-amber-500 to-orange-600'"
          @click="useSkill"
        >
          <span>{{ myChar?.active.id === 'charge' ? '💨' : myChar?.active.id === 'rapidfire' ? '🔥' : myChar?.active.id === 'healzone' ? '💚' : myChar?.active.id === 'turret' ? '🗼' : myChar?.active.id === 'frostnova' ? '❄️' : '🎲' }}</span>
          <svg v-if="skillCdPct > 0" class="absolute inset-0 h-full w-full -rotate-90" viewBox="0 0 40 40">
            <circle cx="20" cy="20" r="17" fill="none" stroke="rgba(255,255,255,0.35)" stroke-width="4"
              :stroke-dasharray="`${(1 - skillCdPct) * 107} 107`" />
          </svg>
          <span v-if="skillCdPct > 0" class="absolute text-sm font-black text-white">{{ Math.ceil(gs.hud.skillCd) }}</span>
        </button>
      </div>

      <!-- 虛擬搖桿 -->
      <div
        v-if="joy.active"
        class="pointer-events-none absolute z-10"
        :style="{ left: joy.ox - 56 + 'px', top: joy.oy - 56 + 'px' }"
      >
        <div class="h-28 w-28 rounded-full border-2 border-white/25 bg-white/5" />
        <div
          class="absolute left-1/2 top-1/2 h-12 w-12 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/40 shadow-lg"
          :style="{ transform: `translate(calc(-50% + ${joy.dx}px), calc(-50% + ${joy.dy}px))` }"
        />
      </div>

      <!-- Toasts -->
      <div class="pointer-events-none absolute inset-x-0 bottom-28 flex flex-col items-center gap-1 px-4">
        <p
          v-for="t in gs.toasts" :key="t.id"
          class="rounded-full px-4 py-1.5 text-xs font-bold backdrop-blur-sm"
          :class="t.kind === 'warn' ? 'bg-rose-900/70 text-rose-200' : t.kind === 'good' ? 'bg-emerald-900/70 text-emerald-200' : 'bg-black/60 text-white/80'"
        >{{ t.msg }}</p>
      </div>

      <!-- Debug 面板 -->
      <button v-if="showDebugBtn" class="absolute left-2 bottom-2 rounded bg-black/40 px-2 py-1 text-[10px] text-white/40" @click="gs.showDebug = !gs.showDebug">DBG</button>
      <div v-if="gs.showDebug && gs.debug" class="absolute left-2 bottom-8 w-52 rounded-lg bg-black/70 p-2 font-mono text-[10px] leading-relaxed text-lime-300 backdrop-blur">
        <p>wave {{ gs.debug.wave }} | players {{ gs.debug.players }} | hp {{ gs.debug.avgHpPct }}%</p>
        <p>enemies {{ gs.debug.enemies }} (elite {{ gs.debug.elites }}) | drops {{ gs.debug.drops }}</p>
        <p>pressure {{ gs.debug.pressure }} → L{{ gs.debug.directorLevel }} | spawn×{{ gs.debug.spawnMult }} heal×{{ gs.debug.healDropMult }}</p>
        <p>DPS {{ gs.debug.teamDps }} | tick {{ gs.debug.tickMs }}ms | fps {{ engine.fps }}</p>
        <p>event: {{ gs.debug.event }}</p>
        <p>mission: {{ gs.debug.missionProgress }}</p>
        <div class="mt-1 flex flex-wrap gap-1">
          <button class="rounded bg-white/10 px-1.5" @click="api.debug({ c: 'skipWave' })">跳波</button>
          <button class="rounded bg-white/10 px-1.5" @click="api.debug({ c: 'gold', n: 100 })">+金</button>
          <button class="rounded bg-white/10 px-1.5" @click="api.debug({ c: 'xp', n: 50 })">+XP</button>
          <button class="rounded bg-white/10 px-1.5" @click="api.debug({ c: 'spawn', id: 'slug', n: 10 })">生怪</button>
          <button class="rounded bg-white/10 px-1.5" @click="api.debug({ c: 'boss', id: 'onion_king' })">Boss</button>
          <button class="rounded bg-white/10 px-1.5" @click="api.debug({ c: 'god' })">無敵</button>
        </div>
      </div>

      <!-- ============================ 中場（結算/升級/寶箱/商店/路線） -->
      <div v-if="gs.inter" class="absolute inset-0 overflow-y-auto bg-black/80 backdrop-blur-sm" style="touch-action: pan-y;">
        <div class="mx-auto max-w-md px-4 py-5 pb-24">
          <!-- 結算 -->
          <div class="rounded-2xl border border-white/10 bg-white/5 p-4 text-center">
            <p class="text-xs text-white/40">第 {{ gs.inter.wave }} 波完成</p>
            <p class="mt-1 text-4xl font-black" :class="gs.inter.settlement.teamGrade === 'S' ? 'text-amber-300' : gs.inter.settlement.teamGrade === 'A' ? 'text-lime-300' : 'text-white/70'">
              {{ gs.inter.settlement.teamGrade }}
            </p>
            <p class="text-xs" :class="gs.inter.settlement.missionDone ? 'text-lime-300' : 'text-rose-300'">
              任務{{ gs.inter.settlement.missionDone ? '完成 ✓' : '未完成 ✗' }}
            </p>
            <p v-for="r in gs.inter.settlement.rewards" :key="r" class="text-xs text-amber-200">🎁 {{ r }}</p>
            <div class="mt-2 space-y-1 text-left text-[11px]">
              <div v-for="(st, pid) in gs.inter.settlement.perPlayer" :key="pid" class="flex justify-between rounded bg-white/5 px-2 py-1">
                <span class="font-bold" :class="pid === gs.playerId ? 'text-amber-300' : 'text-white/70'">{{ playerName2(String(pid)) }}</span>
                <span class="text-white/50">擊殺{{ st.kills }} · 金{{ st.gold }} · 傷{{ st.dmgTaken }} · 救{{ st.rescues }}</span>
              </div>
            </div>
          </div>

          <!-- 團隊獎勵三選一（第一關） -->
          <div v-if="gs.inter.teamReward" class="mt-3 rounded-2xl border border-amber-400/40 bg-amber-400/10 p-4">
            <p class="text-center text-sm font-black text-amber-300">🎁 團隊獎勵 — 全隊投票選一個</p>
            <div class="mt-2 space-y-2">
              <button
                v-for="o in gs.inter.teamReward.options" :key="o.id"
                class="w-full rounded-xl border p-3 text-left active:scale-[0.98]"
                :class="gs.inter.teamReward.votes[gs.playerId] === o.id ? 'border-amber-400 bg-amber-400/20' : 'border-white/10 bg-white/5'"
                @click="api.rewardVote(o.id); sfx.click()"
              >
                <span class="text-sm font-bold">{{ o.name }}</span>
                <span class="block text-xs text-white/50">{{ o.description }}</span>
                <span class="mt-1 block text-[10px] text-amber-200">
                  {{ Object.entries(gs.inter.teamReward.votes).filter(([, v]) => v === o.id).map(([k]) => playerName2(k)).join('、') || '—' }}
                </span>
              </button>
            </div>
          </div>

          <!-- 升級選擇 -->
          <div v-if="gs.inter.pendingLevelups > 0 && gs.inter.levelupChoices.length" class="mt-3 rounded-2xl border border-violet-400/40 bg-violet-500/10 p-4">
            <p class="text-center text-sm font-black text-violet-300">⬆️ 升級選擇（還有 {{ gs.inter.pendingLevelups }} 次）</p>
            <div class="mt-2 space-y-2">
              <button
                v-for="c in gs.inter.levelupChoices" :key="c.offerId"
                class="w-full rounded-xl border-2 p-3 text-left active:scale-[0.98]"
                :class="RARITY_STYLE[c.rarity]"
                @click="api.levelup(c.offerId); sfx.levelup()"
              >
                <div class="flex items-center justify-between">
                  <span class="text-sm font-black">{{ upg(c.upgradeId)?.name }}</span>
                  <span class="rounded-full bg-black/30 px-2 py-0.5 text-[10px] font-bold">{{ RARITY_NAME[c.rarity] }}</span>
                </div>
                <span class="mt-0.5 block text-xs opacity-80">{{ upg(c.upgradeId)?.description }}</span>
              </button>
            </div>
          </div>

          <!-- 寶箱 -->
          <div v-for="ch in gs.inter.chests" :key="ch.chestId" class="mt-3 rounded-2xl border border-amber-400/40 bg-gradient-to-b from-amber-500/15 to-transparent p-4">
            <p class="text-center text-sm font-black text-amber-300">📦 開寶箱！選一個獎勵</p>
            <div class="mt-2 space-y-2">
              <button
                v-for="(opt, i) in ch.options" :key="i"
                class="w-full rounded-xl border border-white/15 bg-white/5 p-3 text-left text-sm font-bold active:scale-[0.98]"
                @click="api.chest(ch.chestId, opt.rewardId); sfx.chest()"
              >{{ opt.detail }}</button>
            </div>
          </div>

          <!-- 個人商店 -->
          <div class="mt-3 rounded-2xl border border-white/10 bg-white/5 p-4">
            <div class="flex items-center justify-between">
              <p class="text-sm font-black text-sky-300">🛒 個人商店</p>
              <p class="text-sm font-black text-amber-300">💰{{ gs.inter.gold }}</p>
            </div>
            <p v-if="gs.inter.shop.discount > 0" class="text-[10px] text-lime-300">本輪折扣 -{{ Math.round(gs.inter.shop.discount * 100) }}%</p>
            <div class="mt-2 grid grid-cols-2 gap-2">
              <div
                v-for="o in gs.inter.shop.offers" :key="o.offerId"
                class="relative rounded-xl border-2 p-2.5"
                :class="o.sold ? 'opacity-30 border-white/10' : RARITY_STYLE[offerRarity(o)]"
              >
                <button class="absolute right-1.5 top-1.5 text-xs" @click="api.lock(o.offerId, !o.locked)">{{ o.locked ? '🔒' : '🔓' }}</button>
                <p class="pr-5 text-xs font-black leading-tight">{{ offerName(o) }}</p>
                <p class="mt-0.5 text-[10px] leading-tight opacity-70">{{ offerDesc(o) }}</p>
                <button
                  class="mt-1.5 w-full rounded-lg py-1 text-xs font-black active:scale-95"
                  :class="o.sold ? 'bg-white/10 text-white/30' : gs.inter.gold >= o.price ? 'bg-amber-500 text-black' : 'bg-white/10 text-white/30'"
                  :disabled="o.sold"
                  @click="api.buy(o.offerId); sfx.buy()"
                >{{ o.sold ? '已售出' : `💰${o.price}` }}</button>
              </div>
            </div>
            <button
              class="mt-2 w-full rounded-lg bg-white/10 py-1.5 text-xs font-bold text-white/70 active:scale-95"
              @click="api.refresh(); sfx.click()"
            >🔄 刷新商店（💰{{ gs.inter.shop.refreshCost }}）</button>
            <!-- 我的武器 -->
            <p class="mt-3 text-xs font-bold text-white/40">我的武器（{{ gs.inter.me.weapons.length }}/6，點擊賣出 60%）</p>
            <div class="mt-1 flex flex-wrap gap-1.5">
              <button
                v-for="(w, i) in gs.inter.me.weapons" :key="i"
                class="rounded-lg bg-white/10 px-2 py-1 text-xs font-bold active:bg-rose-500/30"
                @click="sellWeapon(i, w.id, w.level)"
              >{{ WEAPON_EMOJI[w.id] }} {{ wpn(w.id)?.name }} <span class="text-amber-300">Lv.{{ w.level }}</span></button>
            </div>
          </div>

          <!-- 團隊商店 -->
          <div v-if="connectedCount >= 1" class="mt-3 rounded-2xl border border-emerald-400/30 bg-emerald-500/5 p-4">
            <p class="text-sm font-black text-emerald-300">🤝 團隊商店 <span class="text-[10px] font-normal text-white/40">{{ connectedCount > 1 ? '過半數投票即購買（全隊分攤）' : '單人直接購買' }}</span></p>
            <div class="mt-2 space-y-1.5">
              <div v-for="t in gs.inter.teamShop.items" :key="t.id" class="flex items-center justify-between gap-2 rounded-lg bg-white/5 px-2.5 py-1.5">
                <div class="min-w-0">
                  <p class="truncate text-xs font-bold" :class="t.bought ? 'text-white/30 line-through' : ''">{{ teamItemOf(t.id)?.name }} <span class="text-amber-300">💰{{ t.price }}</span></p>
                  <p class="truncate text-[10px] text-white/40">{{ teamItemOf(t.id)?.description }}</p>
                  <p v-if="t.votes.length" class="text-[10px] text-emerald-300">{{ t.votes.map(playerName2).join('、') }} 想買</p>
                </div>
                <button
                  v-if="!t.bought"
                  class="shrink-0 rounded-lg px-2.5 py-1 text-xs font-black active:scale-95"
                  :class="t.votes.includes(gs.playerId) ? 'bg-emerald-500/40 text-emerald-100' : 'bg-white/10 text-white/60'"
                  @click="api.teamVote(t.id, !t.votes.includes(gs.playerId)); sfx.click()"
                >{{ t.votes.includes(gs.playerId) ? '✓ 想買' : '投票' }}</button>
                <span v-else class="text-xs text-emerald-300">✓</span>
              </div>
              <div class="flex items-center justify-between rounded-lg bg-white/5 px-2.5 py-1.5">
                <p class="text-xs font-bold">⛑️ 團隊復活 +1 <span class="text-amber-300">💰{{ gs.inter.teamShop.reviveCost }}</span><span class="ml-1 text-[10px] text-white/40">現有 {{ gs.inter.teamShop.revivesOwned }}</span></p>
                <button class="shrink-0 rounded-lg bg-white/10 px-2.5 py-1 text-xs font-black text-white/60 active:scale-95" @click="api.teamRevive(); sfx.click()">投票買</button>
              </div>
            </div>
          </div>

          <!-- 路線選擇 -->
          <div class="mt-3 rounded-2xl border border-white/10 bg-white/5 p-4">
            <p class="text-sm font-black text-orange-300">🗺️ 下一關路線{{ connectedCount > 1 ? '（投票）' : '' }}<span v-if="gs.inter.bossNext" class="ml-1 text-rose-400">⚠️ 下一波 BOSS</span></p>
            <div class="mt-2 space-y-2">
              <button
                v-for="r in gs.inter.routes" :key="r.routeId"
                class="w-full rounded-xl border p-3 text-left active:scale-[0.98]"
                :class="r.votes.includes(gs.playerId) ? 'border-orange-400 bg-orange-400/15' : 'border-white/10 bg-white/5'"
                @click="api.routeVote(r.routeId); sfx.click()"
              >
                <span class="text-sm font-bold">{{ routeOf(r.routeId)?.name }}</span>
                <span class="mt-0.5 block text-[11px] text-lime-300">🎁 {{ routeOf(r.routeId)?.reward }}</span>
                <span class="block text-[11px] text-rose-300">⚠️ {{ routeOf(r.routeId)?.risk }}</span>
                <span v-if="r.votes.length" class="mt-0.5 block text-[10px] text-orange-200">{{ r.votes.map(playerName2).join('、') }}</span>
              </button>
            </div>
          </div>

          <!-- Ready -->
          <button
            class="mt-4 w-full rounded-xl py-4 text-lg font-black shadow-xl active:scale-95"
            :class="interReady ? 'bg-white/10 text-white/50' : 'bg-gradient-to-r from-lime-500 to-emerald-600'"
            :disabled="interReady"
            @click="api.interReady(); sfx.click()"
          >
            {{ interReady ? `等待隊友…（${gs.inter.readySet.length}/${connectedCount}）` : `✅ 準備好了 → 第 ${gs.inter.nextWave} 波` }}
          </button>
        </div>
      </div>

      <!-- ============================ 結算（遊戲結束） -->
      <div v-if="gs.over" class="absolute inset-0 flex items-center justify-center overflow-y-auto bg-black/85 backdrop-blur" style="touch-action: pan-y;">
        <div class="w-full max-w-sm px-5 py-8 text-center">
          <p class="text-5xl">{{ gs.over.victory ? '🏆' : '💀' }}</p>
          <h2 class="mt-2 text-3xl font-black" :class="gs.over.victory ? 'text-amber-300' : 'text-rose-400'">
            {{ gs.over.victory ? '農場保衛成功！' : '全滅…' }}
          </h2>
          <p class="mt-1 text-sm text-white/60">
            {{ MODES.find(m => m.id === gs.over!.mode)?.name ?? '無盡' }}模式 · 撐到第 <b class="text-amber-300">{{ gs.over.wave }}</b> 波 ·
            擊殺 <b class="text-amber-300">{{ gs.over.totalKills }}</b> · {{ Math.floor(gs.over.duration / 60) }} 分 {{ gs.over.duration % 60 }} 秒
          </p>
          <div class="mt-4 space-y-1.5 text-left text-xs">
            <div v-for="(st, pid) in gs.over.perPlayer" :key="pid" class="flex justify-between rounded-lg bg-white/5 px-3 py-2">
              <span class="font-bold" :class="pid === gs.playerId ? 'text-amber-300' : 'text-white/80'">{{ playerName2(String(pid)) }}</span>
              <span class="text-white/50">擊殺{{ st.kills }} · 金{{ st.gold }} · 倒地{{ st.downs }} · 救援{{ st.rescues }}</span>
            </div>
          </div>
          <div class="mt-6 space-y-2">
            <button
              v-if="gs.over.victory && isHost && (gs.over.mode === 'standard' || gs.over.mode === 'quick')"
              class="w-full rounded-xl bg-gradient-to-r from-violet-500 to-fuchsia-600 py-3 font-black active:scale-95"
              @click="api.endless()"
            >🌊 進入無盡模式</button>
            <button
              v-if="isHost"
              class="w-full rounded-xl bg-gradient-to-r from-lime-500 to-emerald-600 py-3 font-black active:scale-95"
              @click="api.start()"
            >🔁 再來一場</button>
            <p v-else class="text-xs text-white/40">等待房主選擇…</p>
            <button class="w-full rounded-xl bg-white/10 py-3 font-bold text-white/70 active:scale-95" @click="exitGame">🚪 離開房間</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
