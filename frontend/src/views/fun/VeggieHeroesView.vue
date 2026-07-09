<script setup lang="ts">
// 菜菜勇者團：無盡農場 — 1~4 人手機合作 Roguelike 生存（全頁遊戲）
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  gs, api, ensureSocket, disconnectSocket, createRoom, joinRoom, leaveRoom,
  bindEngine, unbindEngine, bindChatBubble, bindEmote, pushToast,
} from '@/game/net'
import { voice, joinVoice, leaveVoice, toggleMute as toggleVoiceMute } from '@/game/voice'
import { useHaptics } from '@/game/haptics'
import { useAuthStore } from '@/stores/auth'
import { veggieApi, socialApi, chatApi, type VeggieBoard } from '@/api'
import type { SocialUser } from '@/types'
import { engine, EMOTES } from '@/game/render'
import { useGameSound, playMusic, stopMusic, sfx } from '@/game/sound'
import Portrait from '@/game/Portrait.vue'
import { CHARACTERS, CHARACTER_MAP } from '@game/content/characters'
import { WEAPON_MAP } from '@game/content/weapons'
import { UPGRADE_MAP } from '@game/content/upgrades'
import { ITEM_MAP } from '@game/content/pickups'
import { EVENT_MAP } from '@game/content/events'
import { ZONE_MAP } from '@game/content/zones'
import { SHOP } from '@game/balance'
import type { Mode } from '@game/types'

// 賣出返還比例（跟後端 balance.ts 的 SHOP.sellPct 同步，避免文字寫死過時）
const SELL_PCT_LABEL = Math.round(SHOP.sellPct * 100)

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const { muted, musicOn, toggleMute, toggleMusic } = useGameSound()
const { on: hapticsOn, supported: hapticsSupported, toggle: toggleHaptics } = useHaptics()

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
// 難度固定夢魘（difficulty=2，不再讓玩家選）；人數預設 1
const cfg = ref<{ mode: Mode; difficulty: number; maxPlayers: number }>({ mode: 'standard', difficulty: 2, maxPlayers: 1 })
const MODES: { id: Mode; name: string; desc: string }[] = [
  { id: 'quick', name: '快速', desc: '10 波 · 約 10 分鐘' },
  { id: 'standard', name: '標準', desc: '20 波 · 雙 Boss' },
  { id: 'endless', name: '無盡', desc: '20 波後無盡加壓' },
]
const modeName = (m: string) => m === 'daily' ? '每日挑戰' : (MODES.find(x => x.id === m)?.name ?? '無盡')

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
async function startDaily() {
  if (!playerName.value.trim()) { homeError.value = '先取個名字吧'; return }
  localStorage.setItem('veggie-name', playerName.value.trim())
  busy.value = true
  // 每日挑戰：全球同種子（server 用 dailySeed），單人快速 10 波，另計排行榜
  const err = await createRoom(playerName.value.trim(), { mode: 'daily' as Mode, difficulty: 2, maxPlayers: 1 })
  busy.value = false
  homeError.value = err ?? ''
  if (!err) { sfx.click(); playMusic('lobby') }
}

// ---------------------------------------------------------------- 排行榜
const showBoard = ref(false)
const board = ref<VeggieBoard | null>(null)
const boardLoading = ref(false)
const boardMode = ref<'quick' | 'standard' | 'endless' | 'daily'>('standard')
const boardPlayers = ref(1)
async function loadBoard() {
  boardLoading.value = true
  try {
    board.value = await veggieApi.leaderboard(boardMode.value, boardPlayers.value, boardMode.value === 'daily')
  } catch { board.value = null }
  boardLoading.value = false
}
function openBoard() {
  showBoard.value = true
  sfx.click()
  loadBoard()
}
watch([boardMode, boardPlayers], () => { if (showBoard.value) loadBoard() })
const BOARD_MODES: { id: 'quick' | 'standard' | 'endless' | 'daily'; name: string }[] = [
  { id: 'daily', name: '每日' }, { id: 'standard', name: '標準' }, { id: 'quick', name: '快速' }, { id: 'endless', name: '無盡' },
]

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

// ---------------------------------------------------------------- 接工作台社交
const showInvite = ref(false)
const friends = ref<SocialUser[]>([])
const friendsLoading = ref(false)
const invited = ref<Set<number>>(new Set())
async function openInvite() {
  showInvite.value = true
  friendsLoading.value = true
  try { friends.value = await socialApi.friends() } catch { friends.value = [] }
  friendsLoading.value = false
}
async function inviteFriend(f: SocialUser) {
  if (invited.value.has(f.userId)) return
  try {
    const conv = await chatApi.createDm(f.userId)
    await chatApi.send(conv.id, { content: `🥬 來玩菜菜勇者團！房號 ${gs.room!.code}\n${inviteLink.value}` })
    invited.value = new Set(invited.value).add(f.userId)
    sfx.click()
  } catch { pushToast('邀請失敗，稍後再試', 'warn') }
}

const shared = ref(false)
async function shareResult() {
  if (!gs.over || shared.value) return
  const o = gs.over
  const rankTxt = submitResult.value ? `，排行榜第 ${submitResult.value.rank} 名` : ''
  const txt = `🥬 菜菜勇者團 · ${modeName(o.mode)}${o.victory ? ' 通關 🏆' : ''}！撐到第 ${o.wave} 波、擊殺 ${o.totalKills}${rankTxt}。一起來玩 → ${location.origin}/veggie`
  try {
    const convs = await chatApi.conversations()
    const pub = convs.find(c => c.type === 'PUBLIC')
    if (!pub) { pushToast('找不到公開聊天室', 'warn'); return }
    await chatApi.send(pub.id, { content: txt })
    shared.value = true
    pushToast('已分享到公開聊天室 🎉', 'good')
  } catch { pushToast('分享失敗，稍後再試', 'warn') }
}
watch(() => gs.over, (o) => { if (o) shared.value = false })

const copied = ref(false)
async function copyLink() {
  try {
    await navigator.clipboard.writeText(inviteLink.value)
    copied.value = true
    setTimeout(() => { copied.value = false }, 1500)
  } catch { pushToast('複製失敗，請手動複製', 'warn') }
}

const codeCopied = ref(false)
async function copyCode() {
  if (!gs.room) return
  try {
    await navigator.clipboard.writeText(gs.room.code)
    codeCopied.value = true
    setTimeout(() => { codeCopied.value = false }, 1500)
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
  // 戰士（冷兵器）
  w_sword: '⚔️', w_greatsword: '🗡️', w_spear: '🔱', spin_axe: '🪓', hammer: '🔨',
  // 槍手（槍械）
  pea_gun: '🔫', g_sniper: '🎯', g_shotgun: '💥', g_smg: '🔫', g_minigun: '🌀',
  // 醫生
  heal_orb: '💚', m_needle: '💉', m_cross: '➕', m_biozone: '🧫', m_drone: '🛸',
  // 工程
  turret_gun: '🗼', mine: '💣', drone: '🛸', e_laser: '🔴', e_flame: '🔥',
  // 冰法
  ice_shard: '❄️', fireball: '🔥', lightning: '⚡', y_orb: '🔮', y_frost: '🌨️',
  // 賭徒
  t_dice: '🎲', t_cards: '🃏', t_coin: '🪙', t_orbit: '🍀', t_roulette: '🎰',
  // 刺客
  knife: '🔪', a_fan: '🌀', a_shuriken: '⭐', poison_flask: '🧪', a_drone: '🐝',
  // 武士
  s_iai: '🗡️', s_katana: '⚔️', s_kunai: '🔩', s_wave: '🌊', s_odachi: '🗡️',
  // 仙人掌
  c_gauntlet: '🌵', c_whip: '🌿', c_shield: '🛡️', c_spikes: '📍', c_seed: '🌰',
  // 武僧
  k_fist: '👊', k_palm: '✋', k_kick: '🦵', k_staff: '🦯', k_qi: '☯️',
  // 榴槤
  d_thornshot: '📌', d_spikefan: '🎇', d_caltrop: '✳️', d_spikeorbit: '🌟', d_barb: '🔱',
  // 迷幻大麻
  h_spore: '🍄', h_pollen: '🌼', h_smoke: '💨', h_mirage: '🍃', h_haze: '🔮',
  // 進化武器
  w_excal: '🌅', g_magnum: '✨', m_sanctuary: '💖', e_bastion: '🏰', y_avalanche: '🌨️', t_jackpot: '🎰',
  a_phantom: '👻', s_zantetsu: '⚡', c_colossus: '🦾', k_hundred: '💥', d_storm: '🌪️', h_dream: '🌙',
}
const SKILL_EMOJI: Record<string, string> = {
  charge: '💨', bulwark: '🛡️', thornsNova: '🌵', rapidfire: '🔥',
  healzone: '💚', turret: '🗼', frostnova: '❄️', fateflip: '🎲',
  whirlslash: '🌀', palmquake: '💥', spikecharge: '🦔', hallucinate: '🍃',
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
function useSkill(charge?: number) {
  if (gs.hud.skillCd > 0) return
  const dir = engine.moveDir.active ? engine.moveDir : { x: 0, y: -1 }
  api.skill(engine.myX + dir.x * 300, engine.myY + dir.y * 300, charge)
  // 位移類技能：本地立即預測，避免橡皮筋瞬移/延遲
  const active = myChar.value?.active
  if (active?.id === 'charge') engine.predictDash(dir.x, dir.y, active.params?.dist ?? 300)
  else if (active?.id === 'bulwark') engine.predictBulwark(dir.x, dir.y, active.params?.speed ?? 135, active.params?.duration ?? 2)
}
// 蓄力型技能（榴槤）：按住蓄力、放開釋放
const isChargeSkill = computed(() => myChar.value?.active.id === 'spikecharge')
const charging = ref(false)
let chargeStart = 0
function tickCharge() {
  if (!charging.value) return
  const maxHold = (myChar.value?.active.params?.maxHold ?? 2) * 1000
  engine.myCharge = Math.min(1, (performance.now() - chargeStart) / maxHold)
  requestAnimationFrame(tickCharge)
}
function startSkill() {
  if (!isChargeSkill.value) { useSkill(); return }
  if (gs.hud.skillCd > 0 || charging.value) return
  charging.value = true
  chargeStart = performance.now()
  engine.myCharge = 0
  requestAnimationFrame(tickCharge)
}
function releaseSkill() {
  if (!charging.value) return
  charging.value = false
  const c = engine.myCharge
  engine.myCharge = 0
  useSkill(c)
}

// ---------------------------------------------------------------- 鍵盤操作（電腦瀏覽器）
// WASD / 方向鍵移動，空白鍵放技能。手機用拖曳搖桿，兩者可並存。
const keys = new Set<string>()
const MOVE_KEYS: Record<string, [number, number]> = {
  w: [0, -1], arrowup: [0, -1], s: [0, 1], arrowdown: [0, 1],
  a: [-1, 0], arrowleft: [-1, 0], d: [1, 0], arrowright: [1, 0],
}
function applyKeyMove() {
  let x = 0, y = 0
  for (const k of keys) { const v = MOVE_KEYS[k]; if (v) { x += v[0]; y += v[1] } }
  if (x === 0 && y === 0) { engine.moveDir.active = false; return }
  const d = Math.hypot(x, y)
  engine.moveDir = { x: x / d, y: y / d, active: true }
}
function typingInField() {
  const el = document.activeElement
  return el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')
}
function onKeyDown(e: KeyboardEvent) {
  if (screen.value !== 'game' || gs.inter || gs.over) return
  const k = e.key.toLowerCase()
  if ((k === ' ' || k === 'spacebar') && !typingInField()) { e.preventDefault(); if (!e.repeat) startSkill(); return }
  if (MOVE_KEYS[k] && !typingInField()) { e.preventDefault(); keys.add(k); applyKeyMove() }
}
function onKeyUp(e: KeyboardEvent) {
  const k = e.key.toLowerCase()
  if (k === ' ' || k === 'spacebar') { releaseSkill(); return }
  if (MOVE_KEYS[k]) { keys.delete(k); applyKeyMove() }
}
onMounted(() => {
  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('keyup', onKeyUp)
})
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeyDown)
  window.removeEventListener('keyup', onKeyUp)
})
// 離開戰鬥畫面時清掉按鍵狀態，避免卡住移動
watch(screen, (s) => { if (s !== 'game') { keys.clear(); engine.moveDir.active = false } })
const myChar = computed(() => CHARACTER_MAP.get(gs.begin?.players.find(p => p.id === gs.playerId)?.charId ?? ''))
const skillCdPct = computed(() => Math.min(1, gs.hud.skillCd / (myChar.value?.active.cooldown ?? 10)))
const eventName = computed(() => gs.waveInfo?.event ? EVENT_MAP.get(gs.waveInfo.event)?.name : '')
// 殺光制：非 Boss 波、戰鬥中 → 顯示剩餘怪物數（放怪完＝清光才進下一波）
const clearing = computed(() => !gs.hud.boss && gs.hud.enemiesLeft > 0 && !gs.inter && !gs.over)
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
// 高稀有度額外爽度：光暈＋流光掃過（史詩/傳說），詛咒紅光。common/rare 維持乾淨。
const rarityFx = (r: string): string =>
  r === 'legendary' ? 'rar-shine rar-legendary'
    : r === 'epic' ? 'rar-shine rar-epic'
    : r === 'cursed' ? 'rar-cursed'
    : ''
const upg = (id: string) => UPGRADE_MAP.get(id)
const wpn = (id: string) => WEAPON_MAP.get(id)
const itemOf = (id: string) => ITEM_MAP.get(id)
const playerName2 = (id: string) => gs.begin?.players.find(p => p.id === id)?.name ?? '?'

// 角色數值長條（跨全角色正規化，讓特性一目了然）
function charStatRows(charId: string) {
  const b = CHARACTER_MAP.get(charId)?.baseStats
  if (!b) return []
  const norm = (v: number, lo: number, hi: number) => Math.round(Math.max(6, Math.min(100, (v - lo) / (hi - lo) * 100)))
  return [
    { label: '血', pct: norm(b.maxHp, 70, 180), color: 'bg-rose-400' },
    { label: '攻', pct: norm(b.damage, 0.75, 1.4), color: 'bg-orange-400' },
    { label: '攻速', pct: norm(b.attackSpeed, 0.85, 1.3), color: 'bg-amber-400' },
    { label: '速', pct: norm(b.moveSpeed, 145, 198), color: 'bg-sky-400' },
    { label: '甲', pct: norm(b.armor, 0, 7), color: 'bg-slate-300' },
    { label: '暴', pct: norm(b.critChance, 0.03, 0.24), color: 'bg-violet-400' },
  ]
}

function offerName(o: { kind: string; refId: string; weaponLevel?: number }): string {
  if (o.kind === 'mystery') return o.refId === 'rare' ? '✨ 稀有福袋' : '🎁 神秘福袋'
  if (o.kind === 'weapon') return `${WEAPON_EMOJI[o.refId] ?? '⚔️'} ${wpn(o.refId)?.name}${(o.weaponLevel ?? 1) > 1 ? ` Lv.${o.weaponLevel}` : ''}`
  if (o.kind === 'item') return `${itemOf(o.refId)?.emoji ?? '✨'} ${itemOf(o.refId)?.name}`
  return upg(o.refId)?.name ?? o.refId
}
function offerDesc(o: { kind: string; refId: string }): string {
  if (o.kind === 'mystery') return o.refId === 'rare' ? '必開武器／稀有升級／大筆金幣' : '開出隨機武器／道具／金幣'
  if (o.kind === 'weapon') return wpn(o.refId)?.description ?? ''
  if (o.kind === 'item') return itemOf(o.refId)?.description ?? ''
  return upg(o.refId)?.description ?? ''
}
function offerRarity(o: { kind: string; refId: string }): string {
  if (o.kind === 'mystery') return o.refId === 'rare' ? 'legendary' : 'epic'
  if (o.kind === 'upgrade') return upg(o.refId)?.rarity ?? 'common'
  if (o.kind === 'weapon') return (wpn(o.refId)?.tier ?? 1) >= 3 ? 'epic' : (wpn(o.refId)?.tier ?? 1) >= 2 ? 'rare' : 'common'
  return 'common'
}
const interReady = computed(() => !!gs.inter?.readySet.includes(gs.playerId))
// 職業專屬（簽名）武器：帶 charId ＝ 只有本角色拿得到 → 不可出售
const isSigWeapon = (id: string) => !!wpn(id)?.charId
function sellWeapon(i: number, id: string, level: number) {
  if (isSigWeapon(id)) { pushToast('職業專屬武器無法出售', 'warn'); return }
  if ((gs.inter?.me.weapons.length ?? 0) <= 1) { pushToast('至少要保留一把武器', 'warn'); return }
  if (window.confirm(`賣出 ${wpn(id)?.name} Lv.${level}？（拿回 ${SELL_PCT_LABEL}% 金幣）`)) api.sell(i)
}
const connectedCount = computed(() => gs.room?.players.filter(p => p.connected).length ?? 1)

// ---------------------------------------------------------------- Debug
const showDebugBtn = computed(() => import.meta.env.DEV || route.query.debug === '1')

// ---------------------------------------------------------------- 生命週期
onMounted(() => {
  ensureSocket()
  const q = String(route.query.room ?? '')
  if (q) joinCode.value = q.toUpperCase()
  // 已登入工作台 → 直接用工作台的名字
  if (auth.isAuthenticated && auth.displayName && auth.displayName !== '使用者') {
    playerName.value = auth.displayName.slice(0, 12)
  }
})

// ---------------------------------------------------------------- 聊天 / 語音
const chatOpen = ref(false)
const chatInput = ref('')
const chatNow = ref(Date.now())
let chatTicker: ReturnType<typeof setInterval> | null = null
onMounted(() => { chatTicker = setInterval(() => { chatNow.value = Date.now() }, 3000) })
onBeforeUnmount(() => { if (chatTicker) clearInterval(chatTicker) })
// 戰鬥中只顯示 12 秒內的最新 4 則（完整記錄在大廳聊天框）
const recentChat = computed(() => gs.chat.filter(m => chatNow.value - m.at < 12000).slice(-4))
function sendChat() {
  const t = chatInput.value.trim()
  if (!t) return
  api.chatSend(t)
  chatInput.value = ''
}
function onVoiceBtn() {
  if (!voice.enabled) void joinVoice()
  else toggleVoiceMute()
}
watch(() => voice.error, (e) => { if (e) pushToast(e, 'warn') })

// 快捷表情
const emotePalette = ref(false)
const emotes = EMOTES
function sendEmote(n: number) {
  api.emote(n)
  engine.showEmote(gs.playerId, n)   // 本機立即顯示
  emotePalette.value = false
}

// 暫停（單人）
const isSolo = computed(() => (gs.begin?.players.length ?? gs.room?.players.length ?? 1) === 1)
function togglePause() {
  if (!isSolo.value) return
  api.pause(!gs.paused)
}

// 陣亡觀戰
const spectating = computed(() => gs.hud.status === 'dead' && gs.hud.mates.some(m => m.st === 'alive' || m.st === 'downed'))
const spectateName = computed(() => {
  const m = gs.hud.mates.find(m => m.id === engine.spectateId)
  return m?.name ?? gs.hud.mates.find(m => m.st === 'alive')?.name ?? ''
})

watch(screen, async (s) => {
  if (s === 'game') {
    await nextTick()
    bindChatBubble((id, text) => engine.say(id, text))
    bindEmote((id, n) => engine.showEmote(id, n))
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
    bindChatBubble(null)
    bindEmote(null)
    if (s === 'lobby' || s === 'select') playMusic('lobby')
    if (s === 'home') stopMusic()
  }
}, { immediate: true })

const submitResult = ref<{ best: boolean; rank: number } | null>(null)
watch(() => gs.over, async (o) => {
  if (!o) return
  if (o.victory) sfx.victory(); else sfx.defeat()
  const { haptics } = await import('@/game/haptics')
  haptics.gameover()
  // 紀錄最高波數（本機）
  const key = `veggie-best-${o.mode}`
  const prev = Number(localStorage.getItem(key) ?? 0)
  if (o.wave > prev) localStorage.setItem(key, String(o.wave))
  // 登入者：把成績上傳排行榜
  submitResult.value = null
  if (auth.isAuthenticated) {
    try {
      submitResult.value = await veggieApi.submit({
        mode: o.mode,
        players: gs.begin?.players.length ?? 1,
        wave: o.wave,
        kills: o.totalKills,
        durationSec: o.duration,
        daily: o.mode === 'daily',
      })
    } catch { /* 排行榜提交失敗不影響遊戲 */ }
  }
})

onBeforeUnmount(() => {
  engine.stop()
  unbindEngine()
  bindChatBubble(null)
  leaveVoice()
  stopMusic()
  // 離開遊戲頁就斷線（session 保留，回來會自動重連進房）— 避免掛著的分頁讓 Cloud Run 一直計費
  disconnectSocket()
})

function exitGame() {
  showExitConfirm.value = false
  try { leaveRoom() } catch { /* ignore */ }
  try { leaveVoice() } catch { /* ignore */ }
  try { stopMusic() } catch { /* ignore */ }
  // 直接離開 /veggie 路由 → 整個遊戲元件卸載（onBeforeUnmount 會 engine.stop + 斷線），
  // 保證退出，不再依賴反應式 gs.room 清空（修「要按兩次才真的退出」）
  router.push('/fun/games')
}

/** 遊戲進行中退出：改用自製確認覆蓋層（window.confirm 在遊戲的 pointer-capture 下常要按兩次） */
const showExitConfirm = ref(false)
function confirmExit() { showExitConfirm.value = true }
function backToStudio() {
  router.push('/fun/games')
}

const bestWaves = computed(() => ({
  quick: localStorage.getItem('veggie-best-quick') ?? '—',
  standard: localStorage.getItem('veggie-best-standard') ?? '—',
  endless: localStorage.getItem('veggie-best-endless') ?? '—',
}))
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
            <span class="rounded-full bg-rose-500/25 px-2.5 py-1 text-xs font-bold text-rose-200">🔥 夢魘難度</span>
            <div class="flex items-center gap-1">
              <span class="text-xs text-white/50">人數上限</span>
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
              v-model="joinCode" maxlength="4" placeholder="房號" inputmode="numeric" pattern="[0-9]*"
              class="w-28 rounded-xl border border-white/15 bg-white/10 px-3 py-2.5 text-center text-lg font-black tracking-widest outline-none focus:border-sky-400"
              @keyup.enter="doJoin()"
            >
            <button
              class="flex-1 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 py-2.5 font-black active:scale-95 disabled:opacity-50"
              :disabled="busy" @click="doJoin()"
            >🚪 加入房間</button>
          </div>
        </div>
        <!-- 每日挑戰 + 排行榜 -->
        <div class="grid grid-cols-2 gap-3">
          <button
            class="rounded-2xl border border-fuchsia-400/40 bg-gradient-to-br from-fuchsia-600/20 to-transparent p-4 text-center active:scale-95 disabled:opacity-50"
            :disabled="busy" @click="startDaily"
          >
            <span class="block text-2xl">📅</span>
            <span class="block text-sm font-black text-fuchsia-200">每日挑戰</span>
            <span class="block text-[10px] text-white/40">全球同種子 · 單人 · 拚排行</span>
          </button>
          <button
            class="rounded-2xl border border-amber-400/40 bg-gradient-to-br from-amber-500/20 to-transparent p-4 text-center active:scale-95"
            @click="openBoard"
          >
            <span class="block text-2xl">🏆</span>
            <span class="block text-sm font-black text-amber-200">排行榜</span>
            <span class="block text-[10px] text-white/40">最高波數 · 分模式/人數</span>
          </button>
        </div>
        <p v-if="homeError" class="text-center text-sm font-bold text-rose-400">{{ homeError }}</p>
        <p v-if="!gs.connected && gs.connecting" class="text-center text-xs text-white/40">連線中…</p>
        <p v-else-if="gs.error" class="text-center text-xs text-rose-300/70">{{ gs.error }}（伺服器沒開？）</p>
        <div class="rounded-xl bg-white/5 px-4 py-3 text-center text-xs text-white/40">
          我的最高　快速 <b class="text-amber-300">{{ bestWaves.quick }}</b> 波 ·
          標準 <b class="text-amber-300">{{ bestWaves.standard }}</b> 波 ·
          無盡 <b class="text-amber-300">{{ bestWaves.endless }}</b> 波
        </div>
      </div>
    </div>

    <!-- ============================================================ 排行榜 overlay -->
    <div v-if="showBoard" class="absolute inset-0 z-[70] flex flex-col overflow-y-auto bg-[#0d1a0d]/95 px-5 py-6 backdrop-blur" style="touch-action: pan-y;">
      <div class="mx-auto w-full max-w-md">
        <div class="mb-3 flex items-center justify-between">
          <h2 class="text-xl font-black text-amber-300">🏆 排行榜</h2>
          <button class="rounded-lg bg-white/10 px-3 py-1.5 text-sm text-white/70" @click="showBoard = false">關閉 ✕</button>
        </div>
        <!-- 模式 tabs -->
        <div class="mb-2 flex gap-1.5">
          <button
            v-for="m in BOARD_MODES" :key="m.id"
            class="flex-1 rounded-lg px-1 py-1.5 text-xs font-bold transition"
            :class="boardMode === m.id ? 'bg-amber-500/30 text-amber-200' : 'bg-white/5 text-white/40'"
            @click="boardMode = m.id"
          >{{ m.name }}</button>
        </div>
        <!-- 人數 tabs（每日固定 1 人不顯示） -->
        <div v-if="boardMode !== 'daily'" class="mb-3 flex items-center justify-center gap-1.5 text-xs">
          <span class="text-white/40">人數</span>
          <button
            v-for="n in 4" :key="n"
            class="h-7 w-8 rounded font-bold"
            :class="boardPlayers === n ? 'bg-sky-500/30 text-sky-200' : 'bg-white/5 text-white/40'"
            @click="boardPlayers = n"
          >{{ n }}</button>
        </div>
        <p v-if="board?.daily" class="mb-2 text-center text-xs text-fuchsia-300">📅 {{ board.dailyKey }} 每日挑戰</p>

        <div v-if="boardLoading" class="py-10 text-center text-sm text-white/40">載入中…</div>
        <template v-else-if="board && board.entries.length">
          <div class="space-y-1">
            <div
              v-for="e in board.entries" :key="e.rank"
              class="flex items-center gap-2 rounded-lg px-3 py-2"
              :class="e.mine ? 'bg-amber-400/15 ring-1 ring-amber-400/40' : 'bg-white/5'"
            >
              <span class="w-7 text-center text-sm font-black" :class="e.rank === 1 ? 'text-amber-300' : e.rank === 2 ? 'text-slate-300' : e.rank === 3 ? 'text-orange-400' : 'text-white/40'">
                {{ e.rank <= 3 ? ['🥇','🥈','🥉'][e.rank - 1] : e.rank }}
              </span>
              <img v-if="e.photoUrl" :src="e.photoUrl" class="h-7 w-7 rounded-full object-cover">
              <span v-else class="grid h-7 w-7 place-items-center rounded-full bg-white/10 text-xs">🥬</span>
              <span class="flex-1 truncate text-sm font-bold" :class="e.mine ? 'text-amber-200' : 'text-white/80'">{{ e.name }}</span>
              <span class="text-sm font-black text-lime-300">{{ e.wave }} 波</span>
              <span class="w-14 text-right text-[10px] text-white/40">擊殺{{ e.kills }}</span>
            </div>
          </div>
          <!-- 我的名次（不在前 20 時另外顯示） -->
          <div v-if="board.me && board.myRank > 20" class="mt-2 flex items-center gap-2 rounded-lg bg-amber-400/15 px-3 py-2 ring-1 ring-amber-400/40">
            <span class="w-7 text-center text-sm font-black text-amber-300">{{ board.myRank }}</span>
            <span class="grid h-7 w-7 place-items-center rounded-full bg-white/10 text-xs">🥬</span>
            <span class="flex-1 truncate text-sm font-bold text-amber-200">{{ board.me.name }}（我）</span>
            <span class="text-sm font-black text-lime-300">{{ board.me.wave }} 波</span>
          </div>
        </template>
        <div v-else class="py-10 text-center text-sm text-white/40">
          {{ auth.isAuthenticated ? '還沒有人上榜，來當第一名！' : '登入工作台後遊玩即可登上排行榜' }}
        </div>
      </div>
    </div>

    <!-- ============================================================ 邀請好友 overlay -->
    <div v-if="showInvite" class="absolute inset-0 z-[70] flex flex-col overflow-y-auto bg-[#0d1a0d]/95 px-5 py-6 backdrop-blur" style="touch-action: pan-y;">
      <div class="mx-auto w-full max-w-md">
        <div class="mb-3 flex items-center justify-between">
          <h2 class="text-xl font-black text-emerald-300">👥 邀請好友</h2>
          <button class="rounded-lg bg-white/10 px-3 py-1.5 text-sm text-white/70" @click="showInvite = false">關閉 ✕</button>
        </div>
        <p class="mb-3 text-xs text-white/40">會透過工作台私訊把房號與邀請連結傳給好友</p>
        <div v-if="friendsLoading" class="py-10 text-center text-sm text-white/40">載入中…</div>
        <div v-else-if="friends.length" class="space-y-2">
          <div v-for="f in friends" :key="f.userId" class="flex items-center gap-3 rounded-xl bg-white/5 px-3 py-2.5">
            <img v-if="f.photoUrl" :src="f.photoUrl" class="h-9 w-9 rounded-full object-cover">
            <span v-else class="grid h-9 w-9 place-items-center rounded-full bg-white/10">🧑</span>
            <span class="flex-1 truncate font-bold text-white/80">{{ f.displayName ?? f.email }}</span>
            <button
              class="shrink-0 rounded-lg px-3 py-1.5 text-xs font-black active:scale-95"
              :class="invited.has(f.userId) ? 'bg-white/10 text-emerald-300' : 'bg-emerald-500/40 text-emerald-100'"
              @click="inviteFriend(f)"
            >{{ invited.has(f.userId) ? '✅ 已邀請' : '邀請' }}</button>
          </div>
        </div>
        <div v-else class="py-10 text-center text-sm text-white/40">
          還沒有好友，先去工作台的「社交」加好友吧
        </div>
      </div>
    </div>

    <!-- ============================================================ 大廳 -->
    <div v-if="screen === 'lobby'" class="flex flex-1 flex-col items-center overflow-y-auto px-5 py-6" style="touch-action: pan-y;">
      <button class="absolute left-3 top-3 rounded-lg bg-white/10 px-3 py-1.5 text-xs text-white/70" @click="exitGame">← 離開</button>
      <button class="flex flex-col items-center active:scale-95" @click="copyCode">
        <span class="text-xs font-bold text-white/40">房號</span>
        <span class="text-5xl font-black tracking-[0.3em] text-amber-300">{{ gs.room!.code }}</span>
        <span class="mt-0.5 text-[11px] font-bold" :class="codeCopied ? 'text-lime-300' : 'text-sky-300/70'">{{ codeCopied ? '✅ 已複製房號' : '📋 點一下複製房號' }}</span>
      </button>
      <div class="mt-3 flex items-center gap-3">
        <img v-if="qrUrl" :src="qrUrl" alt="QR" class="h-28 w-28 rounded-xl border-4 border-white/80">
        <div class="max-w-[180px] space-y-2">
          <p class="text-xs leading-relaxed text-white/50">朋友掃 QR 或開連結，輸入房號即可加入</p>
          <button class="w-full rounded-lg bg-white/10 px-3 py-2 text-xs font-bold text-sky-300 active:scale-95" @click="copyLink">
            {{ copied ? '✅ 已複製' : '🔗 複製邀請連結' }}
          </button>
          <button v-if="auth.isAuthenticated" class="w-full rounded-lg bg-emerald-500/20 px-3 py-2 text-xs font-bold text-emerald-300 active:scale-95" @click="openInvite">
            👥 邀請好友
          </button>
        </div>
      </div>

      <!-- 房間設定（每日挑戰不可改模式） -->
      <div class="mt-4 flex flex-wrap items-center justify-center gap-2 text-xs">
        <span v-if="gs.room!.config.mode === 'daily'" class="rounded-full bg-fuchsia-500/25 px-3 py-1 font-bold text-fuchsia-200">📅 每日挑戰</span>
        <template v-else-if="isHost">
          <button
            v-for="m in MODES" :key="m.id"
            class="rounded-full border px-3 py-1 font-bold"
            :class="gs.room!.config.mode === m.id ? 'border-lime-400 bg-lime-400/20 text-lime-200' : 'border-white/10 text-white/40'"
            @click="api.setConfig({ mode: m.id })"
          >{{ m.name }}</button>
        </template>
        <template v-else>
          <span class="rounded-full bg-lime-400/20 px-3 py-1 font-bold text-lime-200">{{ modeName(gs.room!.config.mode) }}模式</span>
          <span class="rounded-full bg-sky-400/20 px-3 py-1 font-bold text-sky-200">最多 {{ gs.room!.config.maxPlayers }} 人</span>
        </template>
        <span class="rounded-full bg-rose-400/20 px-3 py-1 font-bold text-rose-200">🔥 夢魘難度</span>
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
            <span v-if="gs.voiceMembers.includes(p.id)" class="text-xs">🎙️</span>
            <span v-if="!p.connected" class="text-[10px] text-rose-300">斷線</span>
          </div>
          <span
            class="rounded-full px-2.5 py-0.5 text-xs font-bold"
            :class="p.ready || p.isHost ? 'bg-lime-400/20 text-lime-300' : 'bg-white/10 text-white/40'"
          >{{ p.isHost ? '房主' : p.ready ? '已準備' : '未準備' }}</span>
        </div>
        <p class="text-center text-xs text-white/30">{{ gs.room!.players.filter(p => p.connected).length }} / {{ gs.room!.config.maxPlayers }} 人</p>
      </div>

      <!-- 隊伍聊天 + 語音 -->
      <div class="mt-3 w-full max-w-sm rounded-xl border border-white/10 bg-white/5 p-3">
        <div class="flex items-center justify-between">
          <p class="text-xs font-bold text-white/50">隊伍聊天</p>
          <div class="flex gap-1.5">
            <button
              class="rounded-lg px-2.5 py-1 text-xs font-bold active:scale-95"
              :class="voice.enabled ? (voice.muted ? 'bg-rose-500/40 text-rose-100' : 'bg-emerald-500/40 text-emerald-100') : 'bg-white/10 text-white/60'"
              @click="onVoiceBtn"
            >{{ !voice.enabled ? '🎙️ 開語音' : voice.muted ? '🙊 已靜音' : '🎙️ 語音中' }}</button>
            <button v-if="voice.enabled" class="rounded-lg bg-white/10 px-2 py-1 text-xs text-white/50" @click="leaveVoice()">關</button>
          </div>
        </div>
        <div class="mt-2 max-h-28 space-y-1 overflow-y-auto">
          <p v-for="m in gs.chat" :key="m.seq" class="text-xs text-white/80"><b class="text-amber-300">{{ m.name }}</b>：{{ m.text }}</p>
          <p v-if="!gs.chat.length" class="text-xs text-white/30">跟隊友打個招呼吧</p>
        </div>
        <div class="mt-2 flex gap-1.5">
          <input
            v-model="chatInput" maxlength="80" placeholder="輸入訊息…"
            class="min-w-0 flex-1 rounded-lg border border-white/15 bg-white/10 px-2.5 py-1.5 text-sm outline-none placeholder:text-white/25 focus:border-sky-400"
            @keyup.enter="sendChat"
          >
          <button class="rounded-lg bg-sky-500/40 px-3 text-sm font-bold text-sky-100 active:scale-95" @click="sendChat">送出</button>
        </div>
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
    <div v-if="screen === 'select'" class="flex flex-1 flex-col overflow-y-auto px-4 py-5" style="touch-action: pan-y;">
      <h2 class="text-center text-xl font-black text-lime-300">選擇你的勇者</h2>
      <div class="mx-auto mt-3 grid w-full max-w-md grid-cols-5 gap-1.5">
        <button
          v-for="c in CHARACTERS" :key="c.id"
          class="flex flex-col items-center rounded-lg border p-1 text-center transition active:scale-95"
          :class="pickedChar === c.id ? 'border-lime-400 bg-lime-400/15 shadow-[0_0_16px_rgba(163,230,53,0.25)]' : 'border-white/10 bg-white/5'"
          @click="pickChar(c.id)"
        >
          <Portrait kind="char" :id="c.id" :size="40" />
          <span class="mt-0.5 text-[10px] font-black leading-tight">{{ c.name }}</span>
          <span class="rounded bg-white/10 px-1 text-[9px] leading-tight text-white/55">{{ ROLE_NAME[c.role] }}</span>
        </button>
      </div>

      <template v-if="pickedChar">
        <p class="mx-auto mt-4 max-w-md text-center text-xs leading-snug text-white/60">{{ CHARACTER_MAP.get(pickedChar)?.description }}</p>
        <h3 v-if="CHARACTER_MAP.get(pickedChar)?.active.id !== 'none'" class="mt-3 text-center text-sm font-black text-amber-300">
          技能：{{ CHARACTER_MAP.get(pickedChar)?.active.name }} — {{ CHARACTER_MAP.get(pickedChar)?.active.description }}
        </h3>
        <div class="h-3" />
        <!-- 角色數值 -->
        <div class="mx-auto mt-2 grid w-full max-w-md grid-cols-3 gap-1.5">
          <div v-for="st in charStatRows(pickedChar)" :key="st.label" class="flex items-center gap-1.5 rounded-lg bg-white/5 px-2 py-1">
            <span class="w-6 shrink-0 text-[10px] text-white/50">{{ st.label }}</span>
            <div class="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
              <div class="h-full rounded-full" :class="st.color" :style="{ width: st.pct + '%' }" />
            </div>
          </div>
        </div>
        <p v-if="CHARACTER_MAP.get(pickedChar)?.weaponClass === 'melee'" class="mt-1.5 text-center text-[11px] font-bold text-emerald-300">🗡️ 只能裝備近戰武器</p>
        <p class="mt-3 text-center text-xs font-bold text-white/50">選擇初始武器</p>
        <div class="mx-auto mt-2 grid w-full max-w-md grid-cols-3 gap-2">
          <button
            v-for="wid in CHARACTER_MAP.get(pickedChar)?.startWeapons ?? []" :key="wid"
            class="rounded-xl border p-2.5 text-center active:scale-95"
            :class="pickedWeapon === wid ? 'border-amber-400 bg-amber-400/15' : 'border-white/10 bg-white/5'"
            @click="pickWeapon(wid)"
          >
            <Portrait kind="weapon" :id="wid" :size="40" class="mx-auto" />
            <span class="mt-0.5 block text-xs font-bold">{{ wpn(wid)?.name }}</span>
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
    <div v-if="screen === 'game'" class="relative flex-1">
      <div
        class="absolute inset-0"
        @pointerdown="onPointerDown" @pointermove="onPointerMove" @pointerup="onPointerUp" @pointercancel="onPointerUp"
      >
        <canvas ref="gameCanvas" class="h-full w-full" />
      </div>

      <!-- 頂部 HUD -->
      <div class="pointer-events-none absolute inset-x-0 top-0 p-2">
        <div class="flex items-start justify-between gap-2">
          <!-- 退出 + 左上資訊欄（波數 → 清怪/任務 → 升級提示，全部疊在左上） -->
          <div class="flex items-start gap-1.5">
            <button
              class="pointer-events-auto grid h-10 w-10 shrink-0 touch-none place-items-center rounded-xl bg-black/45 text-lg text-white/60 backdrop-blur-sm active:scale-90"
              @pointerdown.stop.prevent="confirmExit"
            >✕</button>
            <div class="flex flex-col items-start gap-1">
              <div class="rounded-xl bg-black/45 px-3 py-1.5 backdrop-blur-sm">
                <p class="text-sm font-black text-amber-300">
                  第 {{ gs.hud.wave }} 波
                  <span v-if="gs.hud.boss" class="ml-1 text-rose-300">BOSS</span>
                  <span v-else-if="clearing" class="ml-1 text-white">🐛 剩 {{ gs.hud.enemiesLeft }}</span>
                  <span v-else class="ml-1 text-lime-300">清光通關 ✓</span>
                </p>
                <p class="text-[10px] text-white/50">{{ zoneName }}<span v-if="eventName" class="ml-1 text-rose-300">⚡{{ eventName }}</span></p>
              </div>
              <!-- 殺光制提示 -->
              <div v-if="clearing" class="rounded-lg bg-rose-900/60 px-2.5 py-1 backdrop-blur-sm">
                <p class="text-[11px] font-bold text-rose-200">
                  {{ gs.hud.spawning ? '怪物來襲…殲滅全部進下一波' : '殲滅剩餘怪物即可進下一波！' }}
                </p>
              </div>
              <!-- 任務 -->
              <div v-if="gs.hud.mission" class="rounded-lg bg-black/45 px-2.5 py-1 backdrop-blur-sm">
                <p class="text-[11px] font-bold" :class="gs.hud.mission.failed ? 'text-rose-400' : gs.hud.mission.done ? 'text-lime-400' : 'text-sky-300'">
                  🎯 {{ gs.hud.mission.name }} {{ gs.hud.mission.done ? '✓' : gs.hud.mission.failed ? '✗' : '' }}
                  <span v-if="!gs.hud.mission.done && !gs.hud.mission.failed && gs.hud.mission.target > 1" class="text-white/60">
                    {{ Math.min(gs.hud.mission.progress, gs.hud.mission.target) }}/{{ gs.hud.mission.target }}
                  </span>
                </p>
              </div>
              <!-- 升級提示 -->
              <div v-if="gs.hud.pendingLevelups > 0 && !gs.inter" class="rounded-lg bg-violet-500/70 px-2.5 py-1 backdrop-blur-sm">
                <p class="text-[11px] font-black text-white">⬆️ 升級 ×{{ gs.hud.pendingLevelups }}（波末選擇）</p>
              </div>
            </div>
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
            <p class="mt-0.5 text-right text-[10px] font-black text-orange-300">🗡️ 傷害 {{ gs.hud.dmg.toLocaleString() }}</p>
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

      <!-- 聊天 / 表情 / 語音 / 音效 / 音樂 / 暫停 — 放在小地圖下方（右上）；吃 pointerdown → 移動時也能按 -->
      <div class="absolute right-2 top-[184px] z-30 flex flex-col items-end gap-1.5">
        <button
          class="grid h-9 w-9 touch-none place-items-center rounded-full text-base active:scale-90"
          :class="chatOpen ? 'bg-sky-500/70' : 'bg-black/45'"
          @pointerdown.stop.prevent="chatOpen = !chatOpen"
        >💬</button>
        <button
          class="grid h-9 w-9 touch-none place-items-center rounded-full text-base active:scale-90"
          :class="emotePalette ? 'bg-amber-500/70' : 'bg-black/45'"
          @pointerdown.stop.prevent="emotePalette = !emotePalette"
        >😀</button>
        <button
          class="grid h-9 w-9 touch-none place-items-center rounded-full text-base active:scale-90"
          :class="voice.enabled ? (voice.muted ? 'bg-rose-500/60' : 'bg-emerald-500/60') : 'bg-black/45'"
          @pointerdown.stop.prevent="onVoiceBtn"
        >{{ voice.enabled && voice.muted ? '🙊' : '🎙️' }}</button>
        <button class="grid h-9 w-9 touch-none place-items-center rounded-full bg-black/45 text-base active:scale-90" @pointerdown.stop.prevent="toggleMusic">{{ musicOn ? '🎵' : '🔇' }}</button>
        <button class="grid h-9 w-9 touch-none place-items-center rounded-full bg-black/45 text-base active:scale-90" @pointerdown.stop.prevent="toggleMute">{{ muted ? '🔕' : '🔔' }}</button>
        <button v-if="hapticsSupported" class="grid h-9 w-9 touch-none place-items-center rounded-full bg-black/45 text-base active:scale-90" @pointerdown.stop.prevent="toggleHaptics">{{ hapticsOn ? '📳' : '📴' }}</button>
        <button v-if="isSolo" class="grid h-9 w-9 touch-none place-items-center rounded-full bg-black/45 text-base active:scale-90" @pointerdown.stop.prevent="togglePause">⏸️</button>
      </div>

      <!-- 表情選盤 -->
      <div v-if="emotePalette" class="absolute right-12 top-[184px] z-30 grid grid-cols-4 gap-1.5 rounded-2xl bg-black/70 p-2 backdrop-blur">
        <button
          v-for="(e, i) in emotes" :key="i"
          class="grid h-10 w-10 touch-none place-items-center rounded-xl bg-white/10 text-xl active:scale-90"
          @pointerdown.stop.prevent="sendEmote(i)"
        >{{ e }}</button>
      </div>

      <!-- 陣亡觀戰橫幅 -->
      <div v-if="spectating" class="pointer-events-none absolute inset-x-0 top-1/3 text-center">
        <p class="text-xl font-black text-white/80 drop-shadow">👻 觀戰中</p>
        <p class="text-sm text-white/50">正在觀看 {{ spectateName }}｜等待團隊復活或本波結束</p>
      </div>

      <!-- 離開確認（自製，避免 window.confirm 要按兩次） -->
      <div v-if="showExitConfirm" class="absolute inset-0 z-[85] flex items-center justify-center bg-black/80 backdrop-blur" @pointerdown.self="showExitConfirm = false">
        <div class="mx-6 w-full max-w-xs rounded-2xl border border-white/15 bg-[#141c14] p-5 text-center">
          <p class="text-lg font-black text-white">確定要離開這場遊戲？</p>
          <p class="mt-1 text-xs text-white/50">房間會保留一段時間，可用邀請連結重新加入。</p>
          <div class="mt-4 flex gap-2">
            <button class="flex-1 rounded-xl bg-white/10 py-3 font-bold text-white/70 active:scale-95" @pointerdown.stop.prevent="showExitConfirm = false">取消</button>
            <button class="flex-1 rounded-xl bg-gradient-to-r from-rose-500 to-red-600 py-3 font-black text-white active:scale-95" @pointerdown.stop.prevent="exitGame">離開</button>
          </div>
        </div>
      </div>

      <!-- 暫停覆蓋（單人） -->
      <div v-if="gs.paused" class="absolute inset-0 z-40 flex flex-col items-center justify-center bg-black/80 backdrop-blur">
        <p class="text-3xl font-black text-white">⏸️ 已暫停</p>
        <button class="mt-4 rounded-xl bg-gradient-to-r from-lime-500 to-emerald-600 px-8 py-3 text-lg font-black active:scale-95" @click="togglePause">▶️ 繼續</button>
        <button class="mt-2 rounded-xl bg-white/10 px-8 py-2.5 font-bold text-white/70 active:scale-95" @click="confirmExit">🚪 離開</button>
      </div>

      <!-- 技能按鈕（吃 pointerdown → 移動時也能按） -->
      <div v-if="myChar && myChar.active.id !== 'none'" class="absolute bottom-5 right-4 z-20 flex flex-col items-center gap-3">
        <button
          class="relative grid h-20 w-20 touch-none place-items-center rounded-full border-4 text-3xl shadow-xl active:scale-90"
          :class="skillCdPct > 0 ? 'border-white/20 bg-black/50 grayscale' : (isChargeSkill && charging ? 'border-lime-300 bg-gradient-to-br from-lime-500 to-emerald-600' : 'border-amber-300 bg-gradient-to-br from-amber-500 to-orange-600')"
          @pointerdown.stop.prevent="startSkill"
          @pointerup.stop.prevent="releaseSkill"
          @pointercancel="releaseSkill"
          @pointerleave="releaseSkill"
        >
          <span>{{ SKILL_EMOJI[myChar.active.id] ?? '✨' }}</span>
          <svg v-if="skillCdPct > 0" class="absolute inset-0 h-full w-full -rotate-90" viewBox="0 0 40 40">
            <circle cx="20" cy="20" r="17" fill="none" stroke="rgba(255,255,255,0.35)" stroke-width="4" :stroke-dasharray="`${(1 - skillCdPct) * 107} 107`" />
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

      <!-- Toasts（z 拉到最高，才不會被中場面板蓋住，例如金幣不足警告） -->
      <div class="pointer-events-none absolute inset-x-0 bottom-28 z-[60] flex flex-col items-center gap-1 px-4">
        <p
          v-for="t in gs.toasts" :key="t.id"
          class="rounded-full px-4 py-1.5 text-xs font-bold backdrop-blur-sm"
          :class="t.kind === 'warn' ? 'bg-rose-900/70 text-rose-200' : t.kind === 'good' ? 'bg-emerald-900/70 text-emerald-200' : 'bg-black/60 text-white/80'"
        >{{ t.msg }}</p>
      </div>

      <!-- 遊戲內聊天（戰鬥/中場都可用，蓋在中場面板上層） -->
      <div class="pointer-events-none absolute bottom-14 left-2 z-30 flex max-w-[72%] flex-col items-start gap-1">
        <p
          v-for="m in recentChat" :key="m.seq"
          class="rounded-lg bg-black/55 px-2 py-1 text-[11px] text-white/90 backdrop-blur-sm"
        ><b class="text-amber-300">{{ m.name }}</b>：{{ m.text }}</p>
      </div>
      <div v-if="chatOpen" class="absolute inset-x-2 bottom-28 z-[60] flex gap-1.5">
        <input
          v-model="chatInput" maxlength="80" placeholder="跟隊友說…"
          class="min-w-0 flex-1 rounded-xl border border-white/20 bg-black/70 px-3 py-2 text-sm outline-none backdrop-blur placeholder:text-white/30 focus:border-sky-400"
          @keyup.enter="sendChat"
        >
        <button class="shrink-0 whitespace-nowrap rounded-xl bg-sky-500/80 px-4 py-2 text-sm font-bold active:scale-95" @click="sendChat">送出</button>
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
      <div v-if="gs.inter" class="absolute inset-0 z-[75] overflow-y-auto bg-black/80 backdrop-blur-sm" style="touch-action: pan-y;">
        <div class="mx-auto max-w-md px-4 py-5 pb-24">
          <!-- 結算 -->
          <div class="rounded-2xl border border-white/10 bg-white/5 p-4 text-center">
            <p class="text-xs text-white/40">第 {{ gs.inter.wave }} 波完成</p>
            <p class="mt-1 inline-block text-4xl font-black grade-pop" :class="[gs.inter.settlement.teamGrade === 'S' ? 'text-amber-300 grade-s' : gs.inter.settlement.teamGrade === 'A' ? 'text-lime-300' : 'text-white/70']">
              {{ gs.inter.settlement.teamGrade }}
            </p>
            <p class="text-xs" :class="gs.inter.settlement.missionDone ? 'text-lime-300' : 'text-rose-300'">
              任務{{ gs.inter.settlement.missionDone ? '完成 ✓' : '未完成 ✗' }}
            </p>
            <p v-for="r in gs.inter.settlement.rewards" :key="r" class="text-xs text-amber-200">🎁 {{ r }}</p>
            <div class="mt-2 space-y-1 text-left text-[11px]">
              <div v-for="(st, pid) in gs.inter.settlement.perPlayer" :key="pid" class="flex justify-between rounded bg-white/5 px-2 py-1">
                <span class="font-bold" :class="pid === gs.playerId ? 'text-amber-300' : 'text-white/70'">{{ playerName2(String(pid)) }}</span>
                <span class="text-white/50">擊殺{{ st.kills }} · 傷害{{ st.dmg.toLocaleString() }} · 受傷{{ st.dmgTaken }} · 救{{ st.rescues }}</span>
              </div>
            </div>
          </div>

          <!-- 升級選擇 -->
          <div v-if="gs.inter.pendingLevelups > 0 && gs.inter.levelupChoices.length" class="mt-3 rounded-2xl border border-violet-400/40 bg-violet-500/10 p-4">
            <p class="text-center text-sm font-black text-violet-300">⬆️ 升級選擇（還有 {{ gs.inter.pendingLevelups }} 次）</p>
            <div class="mt-2 space-y-2">
              <button
                v-for="c in gs.inter.levelupChoices" :key="c.offerId"
                class="w-full rounded-xl border-2 p-3 text-left active:scale-[0.98]"
                :class="[RARITY_STYLE[c.rarity], rarityFx(c.rarity)]"
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
            <p v-if="gs.inter.shop.offers.filter(o => o.origPrice).length >= 2" class="text-[11px] font-black text-rose-300">🎉 特價日！全店下殺</p>
            <div class="mt-2 grid grid-cols-2 gap-2">
              <div
                v-for="o in gs.inter.shop.offers" :key="o.offerId"
                class="relative rounded-xl border-2 p-2.5"
                :class="o.sold ? 'opacity-30 border-white/10' : [RARITY_STYLE[offerRarity(o)], rarityFx(offerRarity(o))]"
              >
                <button v-if="o.kind !== 'mystery'" class="absolute right-1.5 top-1.5 text-xs" @click="api.lock(o.offerId, !o.locked)">{{ o.locked ? '🔒' : '🔓' }}</button>
                <span v-if="o.origPrice" class="absolute right-1.5 top-1.5 rounded bg-rose-500 px-1 text-[9px] font-black text-white">特價</span>
                <p class="pr-8 text-xs font-black leading-tight">{{ offerName(o) }}</p>
                <p class="mt-0.5 text-[10px] leading-tight opacity-70">{{ offerDesc(o) }}</p>
                <button
                  class="mt-1.5 w-full rounded-lg py-1 text-xs font-black active:scale-95"
                  :class="o.sold ? 'bg-white/10 text-white/30' : gs.inter.gold >= o.price ? 'bg-amber-500 text-black' : 'bg-white/10 text-white/30'"
                  :disabled="o.sold"
                  @click="api.buy(o.offerId); o.kind === 'mystery' ? sfx.mystery(o.refId === 'rare') : sfx.buy()"
                >
                  <template v-if="o.sold">已售出</template>
                  <template v-else>
                    <span v-if="o.origPrice" class="mr-1 text-[10px] line-through opacity-60">💰{{ o.origPrice }}</span>💰{{ o.price }}
                  </template>
                </button>
              </div>
            </div>
            <button
              class="mt-2 w-full rounded-lg bg-white/10 py-1.5 text-xs font-bold text-white/70 active:scale-95"
              @click="api.refresh(); sfx.click()"
            >🔄 刷新商店（💰{{ gs.inter.shop.refreshCost }}）</button>
            <!-- 我的武器 -->
            <p class="mt-3 text-xs font-bold text-white/40">我的武器（{{ gs.inter.me.weapons.length }}/6，點擊賣出 {{ SELL_PCT_LABEL }}%；🔒＝專屬不可賣）</p>
            <div class="mt-1 flex flex-wrap gap-1.5">
              <button
                v-for="(w, i) in gs.inter.me.weapons" :key="i"
                class="veg-wslot relative flex flex-col items-center gap-0.5 rounded-lg px-1.5 pb-1 pt-1.5 leading-none active:scale-95"
                :class="isSigWeapon(w.id) ? 'opacity-90 ring-1 ring-amber-400/50' : ''"
                :title="isSigWeapon(w.id) ? `${wpn(w.id)?.name}（職業專屬，不可賣）` : wpn(w.id)?.name"
                @click="sellWeapon(i, w.id, w.level)"
              >
                <span v-if="isSigWeapon(w.id)" class="absolute -right-0.5 -top-0.5 text-[10px]">🔒</span>
                <Portrait kind="weapon" :id="w.id" :size="36" />
                <span class="mt-0.5 rounded bg-black/40 px-1 text-[10px] font-black text-amber-300">Lv.{{ w.level }}</span>
              </button>
            </div>
          </div>


          <!-- Boss 預警（下一波是 Boss 時才顯示） -->
          <div v-if="gs.inter.bossNext" class="mt-3 rounded-2xl border border-rose-500/40 bg-rose-600/10 p-3 text-center">
            <p class="text-sm font-black text-rose-300">⚠️ 下一波是 BOSS，準備好再出發！</p>
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
      <div v-if="gs.over" class="absolute inset-0 z-[80] flex items-center justify-center overflow-y-auto bg-black/85 backdrop-blur" style="touch-action: pan-y;">
        <div class="w-full max-w-sm px-5 py-8 text-center">
          <p class="text-5xl">{{ gs.over.victory ? '🏆' : '💀' }}</p>
          <h2 class="mt-2 text-3xl font-black" :class="gs.over.victory ? 'text-amber-300' : 'text-rose-400'">
            {{ gs.over.victory ? '農場保衛成功！' : '全滅…' }}
          </h2>
          <p class="mt-1 text-sm text-white/60">
            {{ modeName(gs.over!.mode) }} · 撐到第 <b class="text-amber-300">{{ gs.over.wave }}</b> 波 ·
            擊殺 <b class="text-amber-300">{{ gs.over.totalKills }}</b> · {{ Math.floor(gs.over.duration / 60) }} 分 {{ gs.over.duration % 60 }} 秒
          </p>
          <!-- 排行榜名次 -->
          <div v-if="submitResult" class="mt-3 rounded-xl border border-amber-400/40 bg-amber-400/10 px-4 py-2">
            <p class="text-sm font-black text-amber-300">
              🏆 排行榜第 {{ submitResult.rank }} 名
              <span v-if="submitResult.best" class="ml-1 text-lime-300">· 刷新自己紀錄！</span>
            </p>
          </div>
          <p v-else-if="!auth.isAuthenticated" class="mt-3 text-xs text-white/40">登入工作台即可登上排行榜</p>

          <div class="mt-4 space-y-1.5 text-left text-xs">
            <div v-for="(st, pid) in gs.over.perPlayer" :key="pid" class="flex justify-between rounded-lg bg-white/5 px-3 py-2">
              <span class="font-bold" :class="pid === gs.playerId ? 'text-amber-300' : 'text-white/80'">{{ playerName2(String(pid)) }}</span>
              <span class="text-white/50">擊殺{{ st.kills }} · 傷害{{ st.dmg.toLocaleString() }} · 倒地{{ st.downs }} · 救援{{ st.rescues }}</span>
            </div>
          </div>
          <div class="mt-6 space-y-2">
            <button
              class="w-full rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 py-3 font-black active:scale-95"
              @click="boardMode = gs.over.mode as any; boardPlayers = gs.begin?.players.length ?? 1; openBoard()"
            >🏆 查看排行榜</button>
            <button
              v-if="auth.isAuthenticated"
              class="w-full rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 py-3 font-black active:scale-95"
              :disabled="shared"
              @click="shareResult"
            >{{ shared ? '✅ 已分享到聊天室' : '📣 分享戰績到公開聊天室' }}</button>
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

<style scoped>
/* 稀有度爽度：史詩/傳說卡片流光掃過 + 光暈；波末評分彈跳揭曉 */
.rar-shine { position: relative; overflow: hidden; }
.rar-shine::before {
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: linear-gradient(115deg, transparent 32%, rgba(255, 255, 255, 0.4) 48%, transparent 64%);
  transform: translateX(-120%);
  animation: rar-shine-sweep 2.8s ease-in-out infinite;
}
@keyframes rar-shine-sweep {
  0% { transform: translateX(-120%); }
  55%, 100% { transform: translateX(120%); }
}
.rar-epic { box-shadow: 0 0 18px -4px rgba(167, 139, 250, 0.65); }
.rar-legendary { animation: rar-legendary-glow 1.7s ease-in-out infinite; }
@keyframes rar-legendary-glow {
  0%, 100% { box-shadow: 0 0 14px -4px rgba(251, 191, 36, 0.5); }
  50% { box-shadow: 0 0 30px 1px rgba(251, 191, 36, 0.9); }
}
.rar-cursed { box-shadow: 0 0 20px -3px rgba(244, 63, 94, 0.6); }

.grade-pop { animation: grade-pop 0.55s cubic-bezier(0.2, 1.5, 0.4, 1) both; transform-origin: center; }
@keyframes grade-pop {
  0% { transform: scale(0.2); opacity: 0; }
  60% { transform: scale(1.18); }
  100% { transform: scale(1); opacity: 1; }
}
.grade-s { text-shadow: 0 0 14px rgba(251, 191, 36, 0.85), 0 0 4px rgba(251, 191, 36, 0.9); }

/* 武器裝備格：漸層槽 + 內陰影，讓縮圖像「收集到的裝備」 */
.veg-wslot {
  background: linear-gradient(160deg, rgba(255, 255, 255, 0.11), rgba(255, 255, 255, 0.02));
  border: 1px solid rgba(255, 255, 255, 0.14);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.12), inset 0 -7px 12px -7px rgba(0, 0, 0, 0.7);
}
.veg-wslot:active { background: rgba(244, 63, 94, 0.28); border-color: rgba(251, 113, 133, 0.6); }

@media (prefers-reduced-motion: reduce) {
  .rar-shine::before { display: none; }
  .rar-legendary, .grade-pop { animation: none; }
}
</style>
