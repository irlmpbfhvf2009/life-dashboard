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
  // HUD 低頻鏡射（由快照更新，10Hz 小物件 OK）
  hud: {
    wave: 0, left: 0, hp: 0, maxHp: 0, shield: 0, gold: 0, lv: 1, xp: 0, nxp: 10,
    skillCd: 0, skillMaxCd: 10, pendingLevelups: 0, teamRevives: 0,
    status: 'alive' as string, reviveProgress: 0,
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

function saveSession(s: Session): void { localStorage.setItem('veggie-session', JSON.stringify(s)) }
export function loadSession(): Session | null {
  try { return JSON.parse(localStorage.getItem('veggie-session') ?? 'null') } catch { return null }
}
export function clearSession(): void { localStorage.removeItem('veggie-session') }

export function ensureSocket(): Socket {
  if (socket) return socket
  gs.connecting = true
  socket = io(SERVER_URL, { transports: ['websocket', 'polling'], reconnection: true })

  socket.on('connect', () => {
    gs.connected = true
    gs.connecting = false
    // 自動重連進房
    const sess = loadSession()
    if (sess && !gs.room) {
      socket!.emit('room:reconnect', sess, (r: { ok: boolean; room?: RoomInfo; playerId?: string }) => {
        if (r.ok && r.room) {
          gs.room = r.room
          gs.playerId = r.playerId!
        } else {
          clearSession()
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
  return socket
}

function syncHud(s: Snapshot): void {
  const me = s.players.find(p => p.id === gs.playerId)
  const h = gs.hud
  h.left = s.left
  h.teamRevives = s.teamRevives
  h.mission = s.mission ?? null
  h.pressureLevel = s.director.level
  if (me) {
    h.hp = me.hp; h.maxHp = me.mhp; h.shield = me.sh; h.gold = me.gold
    h.lv = me.lv; h.xp = me.xp; h.nxp = me.nxp
    h.skillCd = me.cd; h.pendingLevelups = me.pu
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
  skill: (x?: number, y?: number) => socket?.emit('game:skill', { x, y }),
  levelup: (offerId: string) => socket?.emit('inter:levelup', { offerId }),
  chest: (chestId: string, rewardId: string) => socket?.emit('inter:chest', { chestId, rewardId }),
  buy: (offerId: string) => socket?.emit('shop:buy', { offerId }),
  refresh: () => socket?.emit('shop:refresh'),
  lock: (offerId: string, locked: boolean) => socket?.emit('shop:lock', { offerId, locked }),
  sell: (weaponIndex: number) => socket?.emit('shop:sell', { weaponIndex }),
  teamVote: (itemId: string, yes: boolean) => socket?.emit('teamshop:vote', { itemId, yes }),
  teamRevive: () => socket?.emit('teamshop:revive'),
  routeVote: (routeId: string) => socket?.emit('route:vote', { routeId }),
  rewardVote: (id: string) => socket?.emit('teamreward:vote', { id }),
  interReady: () => socket?.emit('inter:ready'),
  endless: () => socket?.emit('room:endless'),
  debug: (cmd: DebugCmd) => socket?.emit('debug:cmd', cmd),
}
