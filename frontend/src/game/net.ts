// Socket.IO 連線 + 遊戲客戶端狀態（module-scope 單例，跨路由保留）。
// 快照走非響應式路徑（供 canvas 迴圈），HUD 需要的低頻狀態才進 reactive。
import { reactive } from 'vue'
import { io, type Socket } from 'socket.io-client'
import type {
  RoomInfo, RoomConfig, Snapshot, GameEv, IntermissionView,
  GameOverSummary, DebugState, DebugCmd, WaveSettlement,
} from '@game/types'

const SERVER_URL =
  (import.meta.env.VITE_GAME_SERVER_URL as string | undefined)
  || `${location.protocol}//${location.hostname}:3001`

export interface WaveStartInfo {
  wave: number; zone: string; event?: string
  mission?: { name: string; desc: string }
  duration: number
  boss?: { id: string; name: string; title: string }
}

export interface GameBeginInfo {
  mode: string
  arena: { w: number; h: number }
  zone: string
  players: { id: string; name: string; charId: string; weapons: { id: string; level: number }[] }[]
}

interface Session { code: string; playerId: string; token: string }

export const gs = reactive({
  connected: false,
  connecting: false,
  error: '' as string,
  room: null as RoomInfo | null,
  playerId: '',
  begin: null as GameBeginInfo | null,
  waveInfo: null as WaveStartInfo | null,
  settlement: null as WaveSettlement | null,
  inter: null as IntermissionView | null,
  over: null as GameOverSummary | null,
  debug: null as DebugState | null,
  showDebug: false,
  toasts: [] as { id: number; msg: string; kind: string }[],
  chat: [] as { seq: number; id: string; name: string; text: string; at: number }[],
  voiceMembers: [] as string[],
  loadouts: {} as Record<string, { id: string; level: number }[]>,
  paused: false,
  // HUD 低頻鏡射（由快照更新，10Hz 小物件 OK）
  hud: {
    wave: 0, left: 0, hp: 0, maxHp: 0, shield: 0, gold: 0, lv: 1, xp: 0, nxp: 10,
    skillCd: 0, skillMaxCd: 10, pendingLevelups: 0, teamRevives: 0,
    status: 'alive' as string, reviveProgress: 0, enemiesLeft: 0, dmg: 0,
    mission: null as null | { name: string; progress: number; target: number; done: boolean; failed?: boolean },
    boss: null as null | { name: string; hp: number; mhp: number; sh?: number },
    mates: [] as { id: string; name: string; charId: string; hp: number; mhp: number; st: string; rp: number }[],
    pressureLevel: 3,
  },
})

let socket: Socket | null = null
let toastSeq = 1

// 給 render 引擎的非響應式 hook（避免 Vue 追蹤 10Hz 大快照）
type SnapFn = (s: Snapshot) => void
type EvFn = (evs: GameEv[]) => void
let onSnap: SnapFn | null = null
let onEvs: EvFn | null = null
let onWave: ((w: WaveStartInfo) => void) | null = null
export function bindEngine(fns: { snap: SnapFn; evs: EvFn; wave: (w: WaveStartInfo) => void }): void {
  onSnap = fns.snap; onEvs = fns.evs; onWave = fns.wave
}
export function unbindEngine(): void { onSnap = null; onEvs = null; onWave = null }

// 聊天氣泡（戰鬥中畫在角色頭上）與語音 signaling 的掛勾
let onChatBubble: ((id: string, text: string) => void) | null = null
export function bindChatBubble(fn: ((id: string, text: string) => void) | null): void { onChatBubble = fn }
let onVoiceMembers: ((ids: string[]) => void) | null = null
let onVoiceSignal: ((from: string, data: unknown) => void) | null = null
export function bindVoice(fns: { members: (ids: string[]) => void; signal: (from: string, data: unknown) => void } | null): void {
  onVoiceMembers = fns?.members ?? null
  onVoiceSignal = fns?.signal ?? null
}

function saveSession(s: Session): void { localStorage.setItem('veggie-session', JSON.stringify(s)) }
export function loadSession(): Session | null {
  try { return JSON.parse(localStorage.getItem('veggie-session') ?? 'null') } catch { return null }
}
export function clearSession(): void { localStorage.removeItem('veggie-session') }

// ---------------------------------------------------------------- 閒置斷線保護
// Cloud Run 對 WebSocket 是「連著就整台計費」— 不在房間 / 分頁背景太久就主動斷線，
// 回來（任何操作或分頁回前景）會自動重連 + 用 session token 重新進房。
const IDLE_MS = 5 * 60_000
let noRoomSince = 0
let hiddenSince = 0
let idleWatch: ReturnType<typeof setInterval> | null = null

export function disconnectSocket(): void {
  if (socket?.connected) socket.disconnect()
  gs.connected = false
}

function startIdleWatch(): void {
  if (idleWatch) return
  idleWatch = setInterval(() => {
    if (!socket?.connected) return
    const now = Date.now()
    if (gs.room) noRoomSince = 0
    else if (!noRoomSince) noRoomSince = now
    if (noRoomSince && now - noRoomSince > IDLE_MS) disconnectSocket()
    else if (hiddenSince && now - hiddenSince > IDLE_MS) disconnectSocket()
  }, 30_000)
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      hiddenSince = Date.now()
    } else {
      hiddenSince = 0
      if (socket && !socket.connected) socket.connect()   // 回前景自動重連
    }
  })
}

export function ensureSocket(): Socket {
  if (socket) {
    if (!socket.connected) socket.connect()
    return socket
  }
  gs.connecting = true
  socket = io(SERVER_URL, { transports: ['websocket', 'polling'], reconnection: true })
  startIdleWatch()

  socket.on('connect', () => {
    gs.connected = true
    gs.connecting = false
    noRoomSince = 0
    // 有 session 一律嘗試重新進房（涵蓋：閒置斷線後回來、Cloud Run 60 分鐘斷線、行動網路切換）
    const sess = loadSession()
    if (sess) {
      socket!.emit('room:reconnect', sess, (r: { ok: boolean; room?: RoomInfo; playerId?: string }) => {
        if (r.ok && r.room) {
          gs.room = r.room
          gs.playerId = r.playerId!
        } else {
          clearSession()
          if (gs.room) resetToHome()   // 房間已不存在 → 回首頁
        }
      })
    }
  })
  socket.on('disconnect', () => { gs.connected = false })
  socket.on('connect_error', () => {
    gs.connecting = false
    gs.error = '無法連上遊戲伺服器'
  })

  socket.on('room:state', (room: RoomInfo) => { gs.room = room; gs.error = '' })
  socket.on('room:closed', () => { resetToHome() })
  socket.on('game:begin', (b: GameBeginInfo) => {
    gs.begin = b
    gs.over = null
    gs.inter = null
    gs.loadouts = Object.fromEntries(b.players.map(p => [p.id, p.weapons]))
  })
  socket.on('wave:start', (w: WaveStartInfo) => {
    gs.waveInfo = w
    gs.inter = null
    gs.hud.wave = w.wave
    onWave?.(w)
  })
  socket.on('game:snap', (s: Snapshot) => {
    onSnap?.(s)
    syncHud(s)
  })
  socket.on('game:ev', (evs: GameEv[]) => { onEvs?.(evs) })
  socket.on('wave:end', (s: WaveSettlement) => { gs.settlement = s })
  socket.on('inter:state', (v: IntermissionView) => { gs.inter = v })
  socket.on('game:over', (s: GameOverSummary) => { gs.over = s })
  socket.on('debug:state', (d: DebugState) => { gs.debug = d })
  socket.on('toast', (t: { msg: string; kind?: string }) => pushToast(t.msg, t.kind ?? 'info'))
  socket.on('chat:msg', (p: { id: string; name: string; text: string }) => {
    gs.chat.push({ seq: toastSeq++, id: p.id, name: p.name, text: p.text, at: Date.now() })
    if (gs.chat.length > 40) gs.chat.shift()
    onChatBubble?.(p.id, p.text)
  })
  socket.on('voice:members', (ids: string[]) => {
    gs.voiceMembers = ids
    onVoiceMembers?.(ids)
  })
  socket.on('voice:signal', (p: { from: string; data: unknown }) => onVoiceSignal?.(p.from, p.data))
  socket.on('game:loadouts', (list: { id: string; weapons: { id: string; level: number }[] }[]) => {
    const map: Record<string, { id: string; level: number }[]> = {}
    for (const l of list) map[l.id] = l.weapons
    gs.loadouts = map
  })
  socket.on('game:emote', (p: { id: string; n: number }) => onEmote?.(p.id, p.n))
  socket.on('game:paused', (paused: boolean) => { gs.paused = paused })
  return socket
}

let onEmote: ((id: string, n: number) => void) | null = null
export function bindEmote(fn: ((id: string, n: number) => void) | null): void { onEmote = fn }

function syncHud(s: Snapshot): void {
  const me = s.players.find(p => p.id === gs.playerId)
  const h = gs.hud
  h.left = s.left
  h.teamRevives = s.teamRevives
  h.mission = s.mission ?? null
  h.pressureLevel = s.director.level
  h.enemiesLeft = s.counts.enemies
  if (me) {
    h.hp = me.hp; h.maxHp = me.mhp; h.shield = me.sh; h.gold = me.gold
    h.lv = me.lv; h.xp = me.xp; h.nxp = me.nxp
    h.skillCd = me.cd; h.pendingLevelups = me.pu; h.dmg = me.dmg
    h.status = me.st; h.reviveProgress = me.rp
  }
  h.mates = s.players.filter(p => p.id !== gs.playerId).map(p => ({
    id: p.id,
    name: gs.begin?.players.find(b => b.id === p.id)?.name ?? '',
    charId: gs.begin?.players.find(b => b.id === p.id)?.charId ?? '',
    hp: p.hp, mhp: p.mhp, st: p.st, rp: p.rp,
  }))
  h.boss = null // boss 由 render 引擎透過 hudBoss 更新（含名稱）
  if (s.boss) {
    const name = gs.waveInfo?.boss?.name ?? 'BOSS'
    h.boss = { name, hp: s.boss.hp, mhp: s.boss.mhp, sh: s.boss.sh }
  }
}

export function pushToast(msg: string, kind = 'info'): void {
  const id = toastSeq++
  gs.toasts.push({ id, msg, kind })
  if (gs.toasts.length > 4) gs.toasts.shift()
  setTimeout(() => { gs.toasts = gs.toasts.filter(t => t.id !== id) }, 3800)
}

export function resetToHome(): void {
  gs.room = null
  gs.begin = null
  gs.waveInfo = null
  gs.inter = null
  gs.over = null
  gs.settlement = null
  clearSession()
}

// ---------------------------------------------------------------- 操作 API

type Ack = { ok: boolean; error?: string; playerId?: string; token?: string; room?: RoomInfo }

export function createRoom(name: string, config: RoomConfig): Promise<string | null> {
  return new Promise(resolve => {
    ensureSocket().emit('room:create', { name, config }, (r: Ack) => {
      if (!r.ok) { resolve(r.error ?? '失敗'); return }
      gs.room = r.room!
      gs.playerId = r.playerId!
      saveSession({ code: r.room!.code, playerId: r.playerId!, token: r.token! })
      resolve(null)
    })
  })
}

export function joinRoom(code: string, name: string): Promise<string | null> {
  return new Promise(resolve => {
    ensureSocket().emit('room:join', { code, name }, (r: Ack) => {
      if (!r.ok) { resolve(r.error ?? '失敗'); return }
      gs.room = r.room!
      gs.playerId = r.playerId!
      saveSession({ code: r.room!.code, playerId: r.playerId!, token: r.token! })
      resolve(null)
    })
  })
}

export function leaveRoom(): void {
  socket?.emit('room:leave')
  resetToHome()
}

export const api = {
  setConfig: (cfg: Partial<RoomConfig>) => socket?.emit('room:config', cfg),
  ready: (r: boolean) => socket?.emit('room:ready', r),
  start: () => socket?.emit('room:start'),
  pick: (p: { charId?: string; weaponId?: string }) => socket?.emit('lobby:pick', p),
  confirm: () => socket?.emit('lobby:confirm'),
  move: (x: number, y: number) => socket?.emit('game:move', { x, y }),
  skill: (x?: number, y?: number, charge?: number) => socket?.emit('game:skill', { x, y, charge }),
  levelup: (offerId: string) => socket?.emit('inter:levelup', { offerId }),
  chest: (chestId: string, rewardId: string) => socket?.emit('inter:chest', { chestId, rewardId }),
  buy: (offerId: string) => socket?.emit('shop:buy', { offerId }),
  refresh: () => socket?.emit('shop:refresh'),
  lock: (offerId: string, locked: boolean) => socket?.emit('shop:lock', { offerId, locked }),
  sell: (weaponIndex: number) => socket?.emit('shop:sell', { weaponIndex }),
  routeVote: (routeId: string) => socket?.emit('route:vote', { routeId }),
  rewardPick: (id: string) => socket?.emit('teamreward:pick', { id }),
  interReady: () => socket?.emit('inter:ready'),
  endless: () => socket?.emit('room:endless'),
  chatSend: (text: string) => socket?.emit('chat:send', { text }),
  voiceJoin: () => socket?.emit('voice:join'),
  voiceLeave: () => socket?.emit('voice:leave'),
  voiceSignal: (to: string, data: unknown) => socket?.emit('voice:signal', { to, data }),
  emote: (n: number) => socket?.emit('game:emote', n),
  pause: (paused: boolean) => socket?.emit('game:pause', paused),
  debug: (cmd: DebugCmd) => socket?.emit('debug:cmd', cmd),
}
